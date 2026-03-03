
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Copy, Loader2, Wallet } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, runTransaction, doc, serverTimestamp, getDocs, where, limit, getDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { marketCoins } from '@/lib/data';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, "Recipient address is required."),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
  asset: z.string().min(1, "Please select an asset."),
});

type SendFormValues = z.infer<typeof sendSchema>;

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet, user } = useWallet();
  const firestore = useFirestore();

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('ETH');

  const userAddress = wallet?.address || '...';
  
  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);
  
  const { data: userWallets } = useCollection(walletsQuery);

  const selectedAssetBalance = useMemo(() => {
    if (!userWallets) return 0;
    const w = userWallets.find(w => w.currency === selectedAsset);
    return w ? w.balance : 0;
  }, [userWallets, selectedAsset]);

  const { 
      register, 
      handleSubmit, 
      formState: { errors, isValid, isSubmitting },
      watch,
      reset,
      setValue
  } = useForm<SendFormValues>({
      resolver: zodResolver(sendSchema),
      defaultValues: { recipientAddress: '', amount: '', asset: 'ETH' },
      mode: 'onChange',
  });

  const formValues = watch();

  useEffect(() => {
    if (wallet?.address) {
      QRCode.toDataURL(wallet.address, { errorCorrectionLevel: 'H', width: 250 })
        .then(setQrCodeDataUrl)
        .catch(err => {
            console.error('Failed to generate QR code', err);
            setQrCodeDataUrl('');
        });
    }
  }, [wallet?.address]);

  const handleAssetChange = (val: string) => {
      setSelectedAsset(val);
      setValue('asset', val, { shouldValidate: true });
  };

  const executeSend = async (data: SendFormValues) => {
    if (!wallet || !user || !firestore) return;

    if (data.recipientAddress.toLowerCase() === userAddress.toLowerCase()) {
        toast({ title: "Invalid Recipient", description: "You cannot send assets to your own wallet.", variant: "destructive"});
        return;
    }
    
    const amount = parseFloat(data.amount);
    if (amount > selectedAssetBalance) {
        toast({ title: "Insufficient Funds", description: `Your balance of ${selectedAssetBalance.toFixed(6)} ${data.asset} is not enough.`, variant: "destructive"});
        return;
    }
    
    try {
        await runTransaction(firestore, async (transaction) => {
            // 1. Identify recipient by their Apex address
            const usersRef = collection(firestore, 'users');
            const recipientQuery = query(usersRef, where("walletAddress", "==", data.recipientAddress), limit(1));
            const recipientSnapshot = await getDocs(recipientQuery);
            
            let recipientId: string | null = null;
            
            if (!recipientSnapshot.empty) {
                recipientId = recipientSnapshot.docs[0].id;
            } else {
                // Check all wallet subcollections for the specific address if main walletAddress lookup fails
                // In a real app we'd index all addresses, but for this simulation we prioritize Apex-to-Apex
                throw new Error("Recipient address not found in the Apex Wallet system.");
            }

            const senderWalletRef = doc(firestore, 'users', user.uid, 'wallets', data.asset);
            const recipientWalletRef = doc(firestore, 'users', recipientId, 'wallets', data.asset);

            const senderWalletDoc = await transaction.get(senderWalletRef);
            if (!senderWalletDoc.exists() || senderWalletDoc.data().balance < amount) {
                throw new Error("Insufficient balance.");
            }

            const recipientWalletDoc = await transaction.get(recipientWalletRef);
            
            const newSenderBalance = senderWalletDoc.data().balance - amount;
            const currentRecipientBalance = recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0;
            const newRecipientBalance = currentRecipientBalance + amount;

            // 2. Perform internal Ledger updates
            transaction.update(senderWalletRef, { balance: newSenderBalance });
            transaction.set(recipientWalletRef, { 
                balance: newRecipientBalance, 
                currency: data.asset,
                id: data.asset,
                userId: recipientId
            }, { merge: true });

            // 3. Log transactions
            const senderTxRef = doc(collection(senderWalletRef, 'transactions'));
            transaction.set(senderTxRef, {
                userId: user.uid,
                type: 'Sell',
                amount: amount,
                price: 0,
                timestamp: serverTimestamp(),
                status: 'Completed',
                recipient: data.recipientAddress,
                notes: `Internal transfer to Apex User`
            });

            const recipientTxRef = doc(collection(recipientWalletRef, 'transactions'));
            transaction.set(recipientTxRef, {
                userId: recipientId,
                type: 'Buy',
                amount: amount,
                price: 0,
                timestamp: serverTimestamp(),
                status: 'Completed',
                sender: userAddress,
                notes: `Internal transfer from Apex User`
            });
        });

        toast({
          title: 'Transaction Successful',
          description: `Successfully sent ${data.amount} ${data.asset} to ${data.recipientAddress.substring(0, 10)}...`,
        });
        reset({ asset: selectedAsset, amount: '', recipientAddress: '' });

    } catch (error: any) {
        console.error("Transaction failed:", error);
        toast({
          title: 'Transaction Failed',
          description: error.message || 'Could not complete the transaction.',
          variant: 'destructive',
        });
    }
  };

  const handleCopyAddress = () => {
    if (wallet?.address) {
        navigator.clipboard.writeText(wallet.address);
        toast({ title: 'Address Copied' });
    }
  };
  
  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-2">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Send & Receive</CardTitle>
            <CardDescription>
                Send dummy assets between Apex users or share your address to receive funds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="send" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="send">Send</TabsTrigger>
                <TabsTrigger value="receive">Receive</TabsTrigger>
              </TabsList>
              <TabsContent value="send" className="pt-6">
                <form onSubmit={handleSubmit(executeSend)} className="space-y-6">
                    <div className="space-y-2">
                        <Label>Select Asset</Label>
                        <Select value={selectedAsset} onValueChange={handleAssetChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select cryptocurrency" />
                            </SelectTrigger>
                            <SelectContent>
                                {marketCoins.map(coin => (
                                    <SelectItem key={coin.symbol} value={coin.symbol}>
                                        <div className="flex items-center gap-2">
                                            <CryptoIcon name={coin.name} className="h-4 w-4" />
                                            {coin.name} ({coin.symbol})
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.asset && <p className="text-sm text-destructive">{errors.asset.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="recipientAddress">Recipient Address</Label>
                        <Input
                            id="recipientAddress"
                            placeholder="Recipient's Apex Wallet Address (0x...)"
                            {...register('recipientAddress')}
                        />
                        {errors.recipientAddress && <p className="text-sm text-destructive">{errors.recipientAddress.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <div className="relative">
                            <Input
                                id="amount"
                                type="number"
                                placeholder="0.00"
                                step="any"
                                {...register('amount')}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary">
                                {selectedAsset}
                            </div>
                        </div>
                        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                            Balance: <span className="font-mono">{selectedAssetBalance.toFixed(6)} {selectedAsset}</span>
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" className="w-full" disabled={!isValid || isSubmitting}>
                                {isSubmitting ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                                ) : (
                                    <>Send {selectedAsset} <ArrowRight className="ml-2" /></>
                                )}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Internal Transfer</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are sending {formValues.amount} {selectedAsset} to an internal Apex address. This action is simulated on our private ledger.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-4 py-4 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Asset</span>
                                    <span className="font-medium flex items-center gap-2">
                                        <CryptoIcon name={marketCoins.find(c => c.symbol === selectedAsset)?.name || ''} />
                                        {selectedAsset}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Recipient</span>
                                    <span className="font-mono break-all text-right ml-4 text-xs">{formValues.recipientAddress}</span>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmit(executeSend)}>Confirm Transfer</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </form>
              </TabsContent>
              <TabsContent value="receive" className="pt-6">
                <div className="flex flex-col items-center justify-center space-y-4 pt-4">
                    <div className="p-4 bg-white rounded-lg border shadow-sm">
                        {qrCodeDataUrl ? (
                            <Image src={qrCodeDataUrl} alt="Wallet QR Code" width={250} height={250} />
                        ) : (
                            <div className="w-[250px] h-[250px] bg-muted animate-pulse rounded-md flex items-center justify-center">
                                <Loader2 className="animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <div className="text-center space-y-2 w-full max-w-xs">
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Your Apex Identity Address</p>
                        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border relative group overflow-hidden">
                            <code className="text-[10px] break-all text-center flex-1">{userAddress}</code>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyAddress}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                            Share this address to receive any supported cryptocurrency from other Apex users.
                        </p>
                    </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
