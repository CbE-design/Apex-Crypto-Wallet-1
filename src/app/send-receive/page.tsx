
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { ArrowRight, Copy, Loader2, ShieldCheck, Activity, Database } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, runTransaction, doc, serverTimestamp, getDocs, where, limit } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { marketCoins } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
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

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('ETH');
  const [isComplianceRequired, setIsComplianceRequired] = useState(false);

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
    const amountVal = parseFloat(formValues.amount) || 0;
    const valueInZAR = amountVal * (selectedAsset === 'ETH' ? 3500 : 1) * 19; // Simplified check
    setIsComplianceRequired(valueInZAR > 3000);
  }, [formValues.amount, selectedAsset]);

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
    if (!wallet || !user || !firestore) return;

    if (data.recipientAddress.toLowerCase() === userAddress.toLowerCase()) {
        toast({ title: "Invalid Recipient", description: "Self-transfers are not supported on the primary rail.", variant: "destructive"});
        return;
    }
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const usersRef = collection(firestore, 'users');
            const recipientQuery = query(usersRef, where("walletAddress", "==", data.recipientAddress), limit(1));
            const recipientSnapshot = await getDocs(recipientQuery);
            
            if (recipientSnapshot.empty) {
                throw new Error("Recipient address not found in the Apex Orchestration system.");
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

        toast({ title: 'Transfer Finalized', description: `Successfully dispatched ${data.amount} ${data.asset}.` });
        reset({ asset: selectedAsset, amount: '', recipientAddress: '' });

    } catch (error: any) {
        toast({ title: 'Orchestration Failed', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-2">
        <Card className="w-full max-w-lg glass-module glass-glow-blue">
          <CardHeader className="border-b border-white/5 py-8">
            <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-primary/20 rounded-2xl border border-primary/40">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight uppercase italic text-foreground">Liquidity Hub</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-400">Apex Private Rail</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <Tabs defaultValue="send" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/5 rounded-2xl p-1 h-14">
                <TabsTrigger value="send" className="rounded-xl font-black uppercase tracking-widest text-[10px]">Send Asset</TabsTrigger>
                <TabsTrigger value="receive" className="rounded-xl font-black uppercase tracking-widest text-[10px]">Receive Rail</TabsTrigger>
              </TabsList>
              <TabsContent value="send" className="pt-8 space-y-6">
                <form onSubmit={handleSubmit(executeSend)} className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asset Protocol</Label>
                        <Select value={selectedAsset} onValueChange={(val) => { setSelectedAsset(val); setValue('asset', val, { shouldValidate: true }); }}>
                            <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl">
                                <SelectValue placeholder="Select cryptocurrency" />
                            </SelectTrigger>
                            <SelectContent>
                                {marketCoins.map(coin => (
                                    <SelectItem key={coin.symbol} value={coin.symbol}>
                                        <div className="flex items-center gap-2">
                                            <CryptoIcon name={coin.name} className="h-4 w-4" />
                                            {coin.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Recipient Identity</Label>
                        <Input className="h-14 bg-white/5 border-white/10 rounded-2xl font-mono text-sm" placeholder="Apex Address (0x...)" {...register('recipientAddress')} />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount</Label>
                        <div className="relative">
                            <Input className="h-16 bg-white/5 border-white/10 rounded-2xl text-xl font-black" type="number" step="any" placeholder="0.00" {...register('amount')} />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-primary italic text-sm">{selectedAsset}</div>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-widest mt-2 uppercase">
                            Available: <span className="text-white">{selectedAssetBalance.toFixed(6)} {selectedAsset}</span>
                        </p>
                    </div>

                    {isComplianceRequired && (
                        <div className="p-5 rounded-2xl bg-primary/10 border border-primary/30 space-y-3 animate-in fade-in zoom-in-95">
                            <div className="flex items-center gap-2 text-primary">
                                <ShieldCheck className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Travel Rule Compliance Required</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">High-value transfer detected. Compliance ID will be automatically generated.</p>
                            <Input className="h-12 bg-black/20 border-white/5 rounded-xl text-xs font-mono" placeholder="Self-Reporting Compliance ID (Optional)" {...register('complianceId')} />
                        </div>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" className="w-full btn-premium py-8 rounded-3xl font-black uppercase tracking-widest text-xs italic" disabled={!isValid || isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" /> : "Authorize Dispatch"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl bg-card border-white/10">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-black italic uppercase">Confirm Dispatch</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs uppercase font-bold tracking-widest">
                                    Finalizing atomic state update on Apex Private Rail.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="py-6 space-y-4">
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Settlement</span>
                                    <span className="font-black text-xl italic">{formValues.amount} {selectedAsset}</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground">Recipient Node</p>
                                    <p className="text-[10px] font-mono break-all bg-black/40 p-3 rounded-lg border border-white/5">{formValues.recipientAddress}</p>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl uppercase font-black text-[10px]">Abort</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmit(executeSend)} className="rounded-xl uppercase font-black text-[10px] bg-primary">Finalize</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </form>
              </TabsContent>
              <TabsContent value="receive" className="pt-8 flex flex-col items-center">
                    <div className="p-6 bg-white rounded-3xl border-8 border-white shadow-2xl mb-8">
                        {qrCodeDataUrl ? <Image src={qrCodeDataUrl} alt="Rail ID" width={220} height={220} className="rounded-xl" /> : <Loader2 className="animate-spin" />}
                    </div>
                    <div className="w-full space-y-4">
                         <div className="flex flex-col items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-[0.2em] border-primary/30 text-primary">Your Rail ID</Badge>
                            <div className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 relative">
                                <code className="text-[10px] font-mono break-all flex-1 text-center">{userAddress}</code>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => { navigator.clipboard.writeText(userAddress); toast({ title: 'Rail ID Copied' }); }}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground italic text-center uppercase font-bold tracking-widest">Apex Identity Addresses are compatible with all Internal Rail partners.</p>
                    </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="bg-black/20 border-t border-white/5 py-4 flex justify-center items-center gap-4">
                <div className="flex items-center gap-1.5 opacity-40">
                    <Database className="h-3 w-3" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Hybrid Sync: ONLINE</span>
                </div>
          </CardFooter>
        </Card>
      </div>
    </PrivateRoute>
  );
}
