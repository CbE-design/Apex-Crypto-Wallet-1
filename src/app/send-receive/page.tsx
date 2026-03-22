
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowRight, Copy, Loader2, ShieldCheck, Send, ArrowDownToLine, QrCode } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, runTransaction, doc, serverTimestamp, getDocs, where, limit } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { marketCoins } from '@/lib/data';
import { useCurrency } from '@/context/currency-context';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, "Recipient address is required."),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
  asset: z.string().min(1, "Please select an asset."),
  complianceId: z.string().optional(),
});

type SendFormValues = z.infer<typeof sendSchema>;

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet, user } = useWallet();
  const { currency, formatCurrency } = useCurrency();
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const paramCurrency = searchParams.get('currency');
  const paramAction = searchParams.get('action');
  const initialAsset = paramCurrency && marketCoins.some(c => c.symbol === paramCurrency) ? paramCurrency : 'ETH';
  const initialTab = paramAction === 'receive' ? 'receive' : 'send';

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(initialAsset);
  const [isComplianceRequired, setIsComplianceRequired] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const userAddress = wallet?.address || '...';
  
  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);
  
  const { data: userWallets } = useCollection(walletsQuery);

  const selectedAssetBalance = useMemo(() => {
    if (!userWallets) return 0;
    const w = userWallets.find(w => w.currency === selectedAsset);
    return w?.balance ?? 0;
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
      defaultValues: { recipientAddress: '', amount: '', asset: initialAsset },
      mode: 'onChange',
  });

  const formValues = watch();

  const [liveAssetPriceUSD, setLiveAssetPriceUSD] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!selectedAsset) return;
    fetch(`/api/prices?symbols=${selectedAsset}&currency=USD`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ prices }: { prices: Record<string, number> }) => {
        setLiveAssetPriceUSD(prev => ({ ...prev, [selectedAsset]: prices[selectedAsset] || 0 }));
      })
      .catch(() => {});
  }, [selectedAsset]);

  useEffect(() => {
    const amountVal = parseFloat(formValues.amount) || 0;
    const assetPriceUSD = liveAssetPriceUSD[selectedAsset] || (selectedAsset === 'ETH' ? 2000 : selectedAsset === 'BTC' ? 82000 : 1);
    const zarRate = 18.62;
    const valueInZAR = amountVal * assetPriceUSD * zarRate;
    setIsComplianceRequired(valueInZAR > 3000);
  }, [formValues.amount, selectedAsset, liveAssetPriceUSD]);

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

  const executeSend = async (data: SendFormValues) => {
    if (!wallet || !user || !firestore || isSending) return;
    setIsSending(true);

    if (data.recipientAddress.toLowerCase() === userAddress.toLowerCase()) {
        toast({ title: "Invalid Recipient", description: "You cannot send to your own address.", variant: "destructive"});
        setIsSending(false);
        return;
    }
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const usersRef = collection(firestore, 'users');
            const recipientQuery = query(usersRef, where("walletAddress", "==", data.recipientAddress), limit(1));
            const recipientSnapshot = await getDocs(recipientQuery);
            
            if (recipientSnapshot.empty) {
                throw new Error("Recipient address not found. Please check the address and try again.");
            }
            const recipientId = recipientSnapshot.docs[0].id;
            const amount = parseFloat(data.amount);

            const senderWalletRef = doc(firestore, 'users', user.uid, 'wallets', data.asset);
            const recipientWalletRef = doc(firestore, 'users', recipientId, 'wallets', data.asset);

            const senderWalletDoc = await transaction.get(senderWalletRef);
            if (!senderWalletDoc.exists() || senderWalletDoc.data().balance < amount) {
                throw new Error("Insufficient balance.");
            }

            const recipientWalletDoc = await transaction.get(recipientWalletRef);
            
            transaction.update(senderWalletRef, { balance: senderWalletDoc.data().balance - amount });
            transaction.set(recipientWalletRef, { 
                balance: (recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0) + amount, 
                currency: data.asset,
                id: data.asset,
                userId: recipientId
            }, { merge: true });

            const senderTxRef = doc(collection(senderWalletRef, 'transactions'));
            transaction.set(senderTxRef, {
                userId: user.uid,
                type: 'Internal Transfer',
                amount: amount,
                price: 0,
                timestamp: serverTimestamp(),
                status: 'Completed',
                recipient: data.recipientAddress,
                metadata: {
                    travelRuleVerified: isComplianceRequired,
                    complianceId: data.complianceId || 'AUTO_KYC_OK'
                }
            });
        });

        toast({ title: 'Transfer Complete', description: `Successfully sent ${data.amount} ${data.asset}.` });
        reset({ asset: selectedAsset, amount: '', recipientAddress: '' });

    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        toast({ title: 'Transfer Failed', description: message, variant: 'destructive' });
    } finally {
        setIsSending(false);
    }
  };

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-2">
        <Card className="w-full max-w-lg bg-card/60 backdrop-blur-sm border-border/60">
          <CardHeader className="border-b border-border/40 pb-5">
            <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold tracking-tight">Send & Receive</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">Transfer crypto to any Apex wallet</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue={initialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/30 rounded-xl p-1 h-11">
                <TabsTrigger value="send" className="rounded-lg text-sm font-medium">Send</TabsTrigger>
                <TabsTrigger value="receive" className="rounded-lg text-sm font-medium">Receive</TabsTrigger>
              </TabsList>
              <TabsContent value="send" className="pt-6 space-y-5">
                <form onSubmit={handleSubmit(executeSend)} className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Asset</Label>
                        <Select value={selectedAsset} onValueChange={(val) => { setSelectedAsset(val); setValue('asset', val, { shouldValidate: true }); }}>
                            <SelectTrigger className="h-12 bg-muted/20 border-border/60 rounded-xl">
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
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Recipient Address</Label>
                        <Input className="h-12 bg-muted/20 border-border/60 rounded-xl font-mono text-sm" placeholder="0x..." {...register('recipientAddress')} />
                        {errors.recipientAddress && <p className="text-xs text-destructive">{errors.recipientAddress.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Amount</Label>
                        <div className="relative">
                            <Input className="h-14 bg-muted/20 border-border/60 rounded-xl text-lg font-semibold pr-16" type="number" step="any" placeholder="0.00" {...register('amount')} />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-primary">{selectedAsset}</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Available: <span className="text-foreground font-medium">{selectedAssetBalance.toFixed(6)} {selectedAsset}</span>
                        </p>
                        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                    </div>

                    {isComplianceRequired && (
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3 animate-in fade-in zoom-in-95">
                            <div className="flex items-center gap-2 text-primary">
                                <ShieldCheck className="h-4 w-4" />
                                <span className="text-xs font-semibold">Additional Verification Required</span>
                            </div>
                            <p className="text-xs text-muted-foreground">This transfer exceeds the threshold for additional verification. A compliance reference will be generated automatically.</p>
                            <Input className="h-10 bg-muted/20 border-border/40 rounded-lg text-xs font-mono" placeholder="Compliance ID (optional)" {...register('complianceId')} />
                        </div>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" className="w-full h-12 rounded-xl font-semibold text-sm btn-premium" disabled={!isValid || isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                {isSubmitting ? "Sending..." : "Send"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl bg-card border-border/60">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-lg font-bold">Confirm Transfer</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                    Please review the details below. This transfer cannot be reversed.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="py-4 space-y-3">
                                <div className="flex justify-between items-center bg-muted/20 p-4 rounded-xl">
                                    <span className="text-sm text-muted-foreground">Amount</span>
                                    <span className="font-bold text-lg">{formValues.amount} {selectedAsset}</span>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">Recipient</p>
                                    <p className="text-xs font-mono break-all bg-muted/20 p-3 rounded-lg border border-border/40">{formValues.recipientAddress}</p>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl" disabled={isSending}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmit(executeSend)} className="rounded-xl bg-primary" disabled={isSending}>
                                    {isSending ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Sending...</> : 'Confirm'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </form>
              </TabsContent>
              <TabsContent value="receive" className="pt-6 space-y-5">
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Your Wallet Address</p>
                        <div className="w-full p-3 bg-muted/20 border border-border/40 rounded-xl flex items-center gap-3">
                            <code className="text-xs font-mono break-all flex-1 text-center">{userAddress}</code>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg flex-shrink-0" onClick={() => { navigator.clipboard.writeText(userAddress); toast({ title: 'Address Copied' }); }}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full h-12 rounded-xl border-border/60 font-semibold text-sm gap-2">
                                <QrCode className="h-4 w-4" />
                                Show QR Code
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xs rounded-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-center text-lg font-bold">Receive Crypto</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="p-4 bg-white rounded-2xl shadow-lg">
                                    {qrCodeDataUrl ? <Image src={qrCodeDataUrl} alt="Deposit QR Code" width={200} height={200} className="rounded-lg" /> : <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />}
                                </div>
                                <div className="w-full p-3 bg-muted/20 border border-border/40 rounded-xl">
                                    <code className="text-[11px] font-mono break-all block text-center">{userAddress}</code>
                                </div>
                                <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => { navigator.clipboard.writeText(userAddress); toast({ title: 'Address Copied' }); }}>
                                    <Copy className="h-4 w-4" /> Copy Address
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <p className="text-xs text-muted-foreground text-center">
                        Share your address or QR code to receive crypto from other Apex wallets.
                    </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
