'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Copy, Loader2 } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, runTransaction, doc, serverTimestamp, getDocs, where, limit } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const sendSchema = z.object({
  recipientAddress: z.string().refine(ethers.isAddress, {
    message: "Please enter a valid Ethereum wallet address.",
  }),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
});

type SendFormValues = z.infer<typeof sendSchema>;

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet, user } = useWallet();
  const firestore = useFirestore();
  const sendAsset = 'ETH';

  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const userAddress = wallet?.address || '...';
  
  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);
  
  const { data: ethWallet } = useDoc<{balance: number}>(ethWalletRef);
  const selectedAssetBalance = ethWallet?.balance ?? 0;

  const { 
      register, 
      handleSubmit, 
      formState: { errors, isValid },
      watch,
      reset
  } = useForm<SendFormValues>({
      resolver: zodResolver(sendSchema),
      defaultValues: { recipientAddress: '', amount: '' },
      mode: 'onChange',
  });

  const formValues = watch();

  useEffect(() => {
    if (wallet?.address) {
      QRCode.toDataURL(wallet.address, { errorCorrectionLevel: 'H', width: 200 })
        .then(setQrCodeDataUrl)
        .catch(err => console.error('Failed to generate QR code', err));
    }
  }, [wallet?.address]);


  const executeSend = async (data: SendFormValues) => {
    if (!wallet || !user || !firestore) return;

    if (data.recipientAddress.toLowerCase() === userAddress.toLowerCase()) {
        toast({ title: "Invalid Recipient", description: "You cannot send assets to your own wallet.", variant: "destructive"});
        return;
    }
    const amount = parseFloat(data.amount);
    if (amount > selectedAssetBalance) {
        toast({ title: "Insufficient Funds", description: `Your balance of ${selectedAssetBalance.toFixed(4)} ETH is not enough.`, variant: "destructive"});
        return;
    }

    setIsLoading(true);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const usersRef = collection(firestore, 'users');
            const recipientQuery = query(usersRef, where("walletAddress", "==", data.recipientAddress), limit(1));
            
            const senderWalletRef = doc(firestore, 'users', user.uid, 'wallets', sendAsset);
            const senderWalletDoc = await transaction.get(senderWalletRef);
            
            const recipientSnapshot = await getDocs(recipientQuery);
            if (recipientSnapshot.empty) {
                throw new Error("Recipient address not found in the Apex Wallet system.");
            }
            const recipientDoc = recipientSnapshot.docs[0];
            const recipientId = recipientDoc.id;
            const recipientWalletRef = doc(firestore, 'users', recipientId, 'wallets', sendAsset);
            
            const senderBalance = senderWalletDoc.exists() ? senderWalletDoc.data().balance : 0;
            if (senderBalance < amount) {
                throw new Error(`Insufficient balance. You only have ${senderBalance.toFixed(6)} ${sendAsset}.`);
            }
            
            const recipientWalletDoc = await transaction.get(recipientWalletRef);
            const newSenderBalance = senderBalance - amount;
            const recipientBalance = recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0;
            const newRecipientBalance = recipientBalance + amount;

            transaction.update(senderWalletRef, { balance: newSenderBalance });
            const senderTxLogRef = doc(collection(senderWalletRef, 'transactions'));
            transaction.set(senderTxLogRef, {
              userId: user.uid, type: 'Sell', amount: amount, price: 0, 
              timestamp: serverTimestamp(), status: 'Completed',
              recipient: data.recipientAddress, sender: userAddress,
            });

            transaction.set(recipientWalletRef, { 
                balance: newRecipientBalance, currency: sendAsset,
                id: sendAsset, userId: recipientId
             }, { merge: true });
            const recipientTxLogRef = doc(collection(recipientWalletRef, 'transactions'));
            transaction.set(recipientTxLogRef, {
              userId: recipientId, type: 'Buy', amount: amount, price: 0,
              timestamp: serverTimestamp(), status: 'Completed',
              sender: userAddress, recipient: data.recipientAddress,
            });
        });

        toast({
          title: 'Transaction Successful',
          description: `Successfully sent ${data.amount} ${sendAsset}.`,
        });
        reset();

    } catch (error: any) {
        console.error("Transaction failed:", error);
        toast({
          title: 'Transaction Failed',
          description: error.message || 'Could not complete the transaction.',
          variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleCopyAddress = () => {
    if (wallet?.address) {
        navigator.clipboard.writeText(wallet.address);
        toast({
        title: 'Address Copied',
        description: 'Your wallet address has been copied to the clipboard.',
        });
    }
  };
  
  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-2">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Send & Receive</CardTitle>
            <CardDescription>
                Easily manage your crypto assets. Send funds to others or receive them into your wallet.
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
                    {selectedAssetBalance === 0 && (
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center space-y-2">
                            <h4 className="font-semibold">Your ETH balance is zero</h4>
                            <p className="text-sm text-muted-foreground">You can receive ETH from another user to get started.</p>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="send-asset">Asset</Label>
                         <div className="flex items-center gap-2 p-2 rounded-md bg-muted w-full">
                            <CryptoIcon name="Ethereum" />
                            <span className="font-semibold">Ethereum (ETH)</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="recipientAddress">Recipient Address</Label>
                        <Input
                            id="recipientAddress"
                            placeholder="0x..."
                            {...register('recipientAddress')}
                            disabled={isLoading}
                        />
                        {errors.recipientAddress && <p className="text-sm text-destructive">{errors.recipientAddress.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            step="any"
                            {...register('amount')}
                            disabled={isLoading}
                        />
                        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                        <p className="text-xs text-muted-foreground mt-1 h-4">
                            {`Balance: ${selectedAssetBalance.toFixed(6)} ${sendAsset}`}
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" className="w-full" disabled={!isValid || isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        Send {sendAsset} <ArrowRight className="ml-2" />
                                    </>
                                )}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Transaction</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are about to send {formValues.amount || '0.00'} {sendAsset}. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-4 py-4 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Asset</span>
                                    <span className="font-medium flex items-center gap-2">
                                        <CryptoIcon name="Ethereum" />
                                        {formValues.amount} {sendAsset}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Recipient</span>
                                    <span className="font-mono break-all text-right ml-4">{formValues.recipientAddress}</span>
                                </div>
                                <div className="flex justify-between font-bold text-base pt-2 border-t">
                                    <span>Total</span>
                                    <span>{formValues.amount} {sendAsset}</span>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmit(executeSend)}>Confirm & Send</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </form>
              </TabsContent>
              <TabsContent value="receive" className="pt-6">
                <div className="flex flex-col items-center justify-center space-y-4 pt-4">
                    <div className="p-4 bg-white rounded-lg border">
                        {qrCodeDataUrl ? (
                            <Image src={qrCodeDataUrl} alt="Wallet QR Code" width={200} height={200} />
                        ) : (
                            <div className="w-[200px] h-[200px] bg-muted animate-pulse rounded-md" />
                        )}
                    </div>
                    <p className="text-sm text-center text-muted-foreground">Your primary wallet address:</p>
                    <div className="flex items-center gap-2 p-3 rounded-md bg-muted w-full justify-center">
                        <code className="text-sm break-all text-center">{userAddress}</code>
                        <Button variant="ghost" size="icon" onClick={handleCopyAddress} disabled={!wallet?.address}>
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Copy address</span>
                        </Button>
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
