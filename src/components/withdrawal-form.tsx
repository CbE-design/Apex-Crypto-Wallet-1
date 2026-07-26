'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useWallet } from '@/context/wallet-context';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { sendWithdrawalRequestEmail } from '@/app/actions/transactional-email';
import { marketCoins } from '@/lib/data';
import { CryptoIcon } from '@/components/crypto-icon';
import { Loader2, Building2, Globe, AlertTriangle, Info, DollarSign, Wallet, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const EFT_FEE_PCT = 0.015;
const EFT_FEE_FLAT = 15;
const SWIFT_FEE_PCT = 0.035;
const SWIFT_FEE_FLAT = 250;
const USD_TO_ZAR = 18.62;

const eftSchema = z.object({
  asset: z.string().min(1, 'Select an asset'),
  zarAmount: z.string().refine(v => parseFloat(v) >= 100, { message: 'Minimum withdrawal is R100' }),
  bankName: z.string().min(2, 'Bank name is required'),
  accountNumber: z.string().min(5, 'Account number is required'),
  accountHolder: z.string().min(2, 'Account holder name is required'),
  branchCode: z.string().optional(),
});

const swiftSchema = z.object({
  asset: z.string().min(1, 'Select an asset'),
  zarAmount: z.string().refine(v => parseFloat(v) >= 1000, { message: 'Minimum SWIFT withdrawal is R1,000' }),
  bankName: z.string().min(2, 'Bank name is required'),
  accountNumber: z.string().min(5, 'Account number is required'),
  accountHolder: z.string().min(2, 'Account holder name is required'),
  swiftCode: z.string().min(8, 'Valid SWIFT/BIC code required'),
  routingNumber: z.string().optional(),
});

type EftValues = z.infer<typeof eftSchema>;
type SwiftValues = z.infer<typeof swiftSchema>;
type WithdrawalFormValues = EftValues | SwiftValues;

interface WalletDoc {
  id: string;
  currency: string;
  balance: number;
}

function generateRef(): string {
  return 'APX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function FeeBreakdown({ zarAmount, method }: { zarAmount: number; method: 'EFT' | 'SWIFT' }) {
  const feePct = method === 'EFT' ? EFT_FEE_PCT : SWIFT_FEE_PCT;
  const feeFlat = method === 'EFT' ? EFT_FEE_FLAT : SWIFT_FEE_FLAT;
  const fee = zarAmount * feePct + feeFlat;
  const net = zarAmount - fee;

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
        <DollarSign className="h-4 w-4 text-emerald-400" />
        <p className="text-xs font-bold uppercase tracking-wider text-white/30">Fee Breakdown</p>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-white/40">
          <span>Gross Amount</span><span className="text-white/80">{fmt(zarAmount)}</span>
        </div>
        <div className="flex justify-between text-white/40">
          <span>Processing Fee ({(feePct * 100).toFixed(1)}% + {fmt(feeFlat)})</span>
          <span className="text-red-400">-{fmt(fee)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-white/[0.06] pt-2">
          <span className="text-white/60">Net Amount</span><span className="text-emerald-400">{fmt(Math.max(0, net))}</span>
        </div>
      </div>
    </div>
  );
}

export function WithdrawalForm() {
  const { user, userProfile } = useWallet();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [method, setMethod] = React.useState<'EFT' | 'SWIFT'>('EFT');
  const [assetPricesUSD, setAssetPricesUSD] = React.useState<Record<string, number>>({});
  const [loadingPrices, setLoadingPrices] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);

  const { data: wallets } = useCollection<WalletDoc>(walletsQuery);

  const eftForm = useForm<EftValues>({
    resolver: zodResolver(eftSchema),
    defaultValues: { asset: '', zarAmount: '', bankName: '', accountNumber: '', accountHolder: '', branchCode: '' },
  });

  const swiftForm = useForm<SwiftValues>({
    resolver: zodResolver(swiftSchema),
    defaultValues: { asset: '', zarAmount: '', bankName: '', accountNumber: '', accountHolder: '', swiftCode: '', routingNumber: '' },
  });

  const eftAsset = eftForm.watch('asset');
  const eftZar = parseFloat(eftForm.watch('zarAmount') || '0') || 0;
  const swiftAsset = swiftForm.watch('asset');
  const swiftZar = parseFloat(swiftForm.watch('zarAmount') || '0') || 0;
  const watchedAsset = method === 'EFT' ? eftAsset : swiftAsset;
  const watchedZar = method === 'EFT' ? eftZar : swiftZar;

  const walletWithBalance = (wallets ?? []).filter(w => w.balance > 0);
  const selectedWallet = wallets?.find(w => w.currency === watchedAsset);
  const assetPriceUSD = assetPricesUSD[watchedAsset] || marketCoins.find(c => c.symbol === watchedAsset)?.priceUSD || 0;
  const assetPriceZAR = assetPriceUSD * USD_TO_ZAR;
  const cryptoEquivalent = assetPriceZAR > 0 ? watchedZar / assetPriceZAR : 0;
  const hasSufficientBalance = selectedWallet ? selectedWallet.balance >= cryptoEquivalent : false;

  React.useEffect(() => {
    if (!watchedAsset) return;
    setLoadingPrices(true);
    fetch(`/api/prices?symbols=${watchedAsset}&currency=USD`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Price fetch failed')))
      .then(({ prices }: { prices: Record<string, number> }) => {
        setAssetPricesUSD(prev => ({ ...prev, [watchedAsset]: prices[watchedAsset] || 0 }));
      })
      .catch(() => {})
      .finally(() => setLoadingPrices(false));
  }, [watchedAsset]);

  const buildPayload = (values: WithdrawalFormValues, withdrawalMethod: 'EFT' | 'SWIFT') => {
    const feePct = withdrawalMethod === 'EFT' ? EFT_FEE_PCT : SWIFT_FEE_PCT;
    const feeFlat = withdrawalMethod === 'EFT' ? EFT_FEE_FLAT : SWIFT_FEE_FLAT;
    const zarGross = parseFloat(values.zarAmount);
    const networkFee = zarGross * feePct + feeFlat;
    const netFiatAmount = Math.max(0, zarGross - networkFee);
    const ref = generateRef();

    return {
      userId: user!.uid,
      userEmail: userProfile?.email || '',
      walletAddress: userProfile?.walletAddress || '',
      cryptoSymbol: values.asset,
      cryptoAmount: cryptoEquivalent,
      cryptoBreakdown: [{ symbol: values.asset, amount: cryptoEquivalent, priceUSD: assetPriceUSD }],
      fiatCurrency: 'ZAR',
      fiatAmount: zarGross,
      netFiatAmount,
      exchangeRate: assetPriceZAR,
      networkFee,
      withdrawalMethod,
      bankName: values.bankName,
      accountNumber: values.accountNumber,
      accountHolder: values.accountHolder,
      routingNumber: ('routingNumber' in values ? values.routingNumber : '') || '',
      swiftCode: ('swiftCode' in values ? values.swiftCode : '') || '',
      status: 'PENDING',
      transactionReference: ref,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  };

  const reserveWithdrawalBalance = async (asset: string, amount: number) => {
    if (!firestore || !user) throw new Error('Missing services');
    const walletRef = doc(firestore, 'users', user.uid, 'wallets', asset);
    await runTransaction(firestore, async (transaction: any) => {
      const walletSnap = await transaction.get(walletRef);
      const currentBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
      const currentReserved = walletSnap.exists() ? (walletSnap.data().reservedForWithdrawal || 0) : 0;

      if (currentBalance < amount) {
        throw new Error(`Insufficient ${asset} balance`);
      }
      transaction.set(walletRef, {
        balance: currentBalance - amount,
        reservedForWithdrawal: currentReserved + amount,
        lastSynced: serverTimestamp(),
      }, { merge: true });
    });
  };

  const restoreWithdrawalBalance = async (asset: string, amount: number) => {
    if (!firestore || !user) return;
    try {
      const walletRef = doc(firestore, 'users', user.uid, 'wallets', asset);
      await runTransaction(firestore, async (transaction: any) => {
        const walletSnap = await transaction.get(walletRef);
        if (walletSnap.exists()) {
          const currentReserved = walletSnap.data().reservedForWithdrawal || 0;
          const currentBalance = walletSnap.data().balance || 0;
          transaction.update(walletRef, {
            reservedForWithdrawal: Math.max(0, currentReserved - amount),
            balance: currentBalance + amount,
            lastSynced: serverTimestamp(),
          });
        }
      });
    } catch (err) {
      console.error('[WithdrawalForm] Failed to restore balance:', err);
    }
  };

  const onSubmitEft = async (values: EftValues) => {
    if (!user || !firestore) return;
    if (!hasSufficientBalance) {
      toast({ title: 'Insufficient Balance', description: `You need ${cryptoEquivalent.toFixed(6)} ${values.asset} but only have ${selectedWallet?.balance.toFixed(6) ?? 0}.`, variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = buildPayload(values, 'EFT');
      await reserveWithdrawalBalance(values.asset, cryptoEquivalent);
      await addDoc(collection(firestore, 'withdrawal_requests'), payload);
      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'WITHDRAWAL_REQUEST',
        title: 'New Withdrawal Request',
        message: `${payload.userEmail || 'A user'} requested an EFT withdrawal of R${parseFloat(values.zarAmount).toFixed(2)}.`,
        userId: user.uid,
        userEmail: payload.userEmail,
        referenceId: payload.transactionReference,
        read: false,
        createdAt: serverTimestamp(),
      });
      eftForm.reset();
      toast({ title: 'Withdrawal Submitted', description: `Reference: ${payload.transactionReference}. Your request is being reviewed.` });

      try {
        if (userProfile?.email && userProfile.email.includes('@')) {
          await sendWithdrawalRequestEmail({
            to: userProfile.email,
            reference: payload.transactionReference,
            method: 'EFT',
            amount: payload.fiatAmount,
          });
        }
      } catch (emailErr) {
        console.error('[WithdrawalForm] EFT email notification failed:', emailErr);
      }
    } catch (err) {
      console.error('[WithdrawalForm] EFT submit error:', err);
      toast({ title: 'Submission Failed', description: 'Could not submit your withdrawal request. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitSwift = async (values: SwiftValues) => {
    if (!user || !firestore) return;
    if (!hasSufficientBalance) {
      toast({ title: 'Insufficient Balance', description: `You need ${cryptoEquivalent.toFixed(6)} ${values.asset} but only have ${selectedWallet?.balance.toFixed(6) ?? 0}.`, variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = buildPayload(values, 'SWIFT');
      await reserveWithdrawalBalance(values.asset, cryptoEquivalent);
      await addDoc(collection(firestore, 'withdrawal_requests'), payload);
      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'WITHDRAWAL_REQUEST',
        title: 'New Withdrawal Request',
        message: `${payload.userEmail || 'A user'} requested a SWIFT withdrawal of R${parseFloat(values.zarAmount).toFixed(2)}.`,
        userId: user.uid,
        userEmail: payload.userEmail,
        referenceId: payload.transactionReference,
        read: false,
        createdAt: serverTimestamp(),
      });
      swiftForm.reset();
      toast({ title: 'Withdrawal Submitted', description: `Reference: ${payload.transactionReference}. Your request is being reviewed.` });

      try {
        if (userProfile?.email && userProfile.email.includes('@')) {
          await sendWithdrawalRequestEmail({
            to: userProfile.email,
            reference: payload.transactionReference,
            method: 'SWIFT',
            amount: payload.fiatAmount,
          });
        }
      } catch (emailErr) {
        console.error('[WithdrawalForm] SWIFT email notification failed:', emailErr);
      }
    } catch (err) {
      console.error('[WithdrawalForm] SWIFT submit error:', err);
      toast({ title: 'Submission Failed', description: 'Could not submit your withdrawal request. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAssetAndAmount = (form: any) => (
    <>
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
        <div className="h-6 w-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Wallet className="h-3 w-3 text-emerald-400" />
        </div>
        <h4 className="text-sm font-semibold text-white">Asset Selection</h4>
      </div>
      <FormField
        control={form.control}
        name="asset"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Crypto Asset to Sell</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white">
                  <SelectValue placeholder="Select asset to withdraw" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {walletWithBalance.length === 0 && (
                  <div className="p-2 text-xs text-white/30 text-center">No assets with available balance</div>
                )}
                {walletWithBalance.map(w => {
                  const coin = marketCoins.find(c => c.symbol === w.currency);
                  return (
                    <SelectItem key={w.currency} value={w.currency}>
                      <div className="flex items-center gap-2">
                        <CryptoIcon name={coin?.name || w.currency} className="h-4 w-4" />
                        <span className="text-white/80">{w.currency}</span>
                        <span className="text-white/30 text-xs ml-1">({w.balance.toFixed(4)})</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="zarAmount"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Withdrawal Amount (ZAR)</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1500.00"
                className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20"
                {...field}
              />
            </FormControl>
            {watchedAsset && watchedZar > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                {loadingPrices ? (
                  <Loader2 className="h-3 w-3 animate-spin text-white/30" />
                ) : (
                  <p className="text-xs text-white/30">
                    ≈ {cryptoEquivalent.toFixed(6)} {watchedAsset} required
                    {!hasSufficientBalance && (
                      <span className="text-red-400 ml-2 font-medium">
                        <AlertTriangle className="inline h-3 w-3 mr-0.5" />Insufficient balance
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {watchedZar >= 25000 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          <span className="text-xs text-amber-300/90 leading-relaxed">Withdrawals over R25,000 require Enhanced Due Diligence (EDD) under FICA regulations. Your request will undergo additional compliance review.</span>
        </div>
      )}
    </>
  );

  const renderBankDetailsEft = () => (
    <>
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
        <div className="h-6 w-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Building2 className="h-3 w-3 text-violet-400" />
        </div>
        <h4 className="text-sm font-semibold text-white">Banking Details (EFT)</h4>
      </div>
      <FormField control={eftForm.control} name="bankName" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Bank Name</FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20" placeholder="e.g. FNB, Standard Bank, Nedbank" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={eftForm.control} name="accountHolder" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Account Holder Name</FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20" placeholder="Full legal name as per bank records" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={eftForm.control} name="accountNumber" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Account Number</FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 font-mono" placeholder="Your bank account number" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={eftForm.control} name="branchCode" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Branch Code <span className="text-white/20 font-normal">(optional)</span></FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 font-mono" placeholder="6-digit branch code" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );

  const renderBankDetailsSwift = () => (
    <>
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
        <div className="h-6 w-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Globe className="h-3 w-3 text-cyan-400" />
        </div>
        <h4 className="text-sm font-semibold text-white">International Banking Details (SWIFT)</h4>
      </div>
      <FormField control={swiftForm.control} name="bankName" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Bank Name</FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20" placeholder="Full international bank name" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={swiftForm.control} name="accountHolder" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Account Holder Name</FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20" placeholder="Full legal name as per bank records" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={swiftForm.control} name="accountNumber" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Account / IBAN Number</FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 font-mono" placeholder="Bank account number or IBAN" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={swiftForm.control} name="swiftCode" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">SWIFT / BIC Code</FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 font-mono uppercase" placeholder="e.g. FIRNZAJJXXX" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={swiftForm.control} name="routingNumber" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-white/40">Routing Number <span className="text-white/20 font-normal">(optional)</span></FormLabel>
          <FormControl><Input className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 font-mono" placeholder="For US/Canadian banks" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );

  return (
    <Card className="rounded-[28px] border border-white/[0.08] bg-[#0A0C12]/90 backdrop-blur-xl overflow-hidden">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <ArrowDownRight className="h-4 w-4 text-emerald-400" />
          </div>
          Withdrawal Request
        </CardTitle>
        <CardDescription className="text-xs mt-2 text-white/30">
          Sell cryptocurrency and receive ZAR to your bank account via EFT or SWIFT transfer
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={method} onValueChange={v => setMethod(v as 'EFT' | 'SWIFT')} className="w-full">
          <TabsList className="grid grid-cols-2 bg-white/[0.04] rounded-2xl p-1 h-12 mb-6 border border-white/[0.06]">
            <TabsTrigger value="EFT" className="rounded-xl text-xs font-semibold gap-2 data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-300 data-[state=active]:border data-[state=active]:border-violet-500/25">
              <Building2 className="h-4 w-4" /> EFT Transfer
              <span className="text-[9px] text-white/30">1.5% + R15</span>
            </TabsTrigger>
            <TabsTrigger value="SWIFT" className="rounded-xl text-xs font-semibold gap-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-500/25">
              <Globe className="h-4 w-4" /> SWIFT Transfer
              <span className="text-[9px] text-white/30">3.5% + R250</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="EFT">
            <Form {...eftForm}>
              <form onSubmit={eftForm.handleSubmit(onSubmitEft)} className="space-y-5">
                {renderAssetAndAmount(eftForm)}
                {watchedZar > 0 && (
                  <FeeBreakdown zarAmount={watchedZar} method="EFT" />
                )}
                {renderBankDetailsEft()}
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold"
                  disabled={isSubmitting || !hasSufficientBalance && watchedZar > 0}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit EFT Withdrawal Request'}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="SWIFT">
            <Form {...swiftForm}>
              <form onSubmit={swiftForm.handleSubmit(onSubmitSwift)} className="space-y-5">
                {renderAssetAndAmount(swiftForm)}
                {watchedZar > 0 && (
                  <FeeBreakdown zarAmount={watchedZar} method="SWIFT" />
                )}
                {renderBankDetailsSwift()}
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold"
                  disabled={isSubmitting || !hasSufficientBalance && watchedZar > 0}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit SWIFT Withdrawal Request'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        <div className="flex items-start gap-3 mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <Info className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-white/60">Processing Information</p>
            <p className="text-[10px] text-white/30 leading-relaxed">
              All withdrawals are subject to compliance review. EFT transfers: 1–2 business days. SWIFT transfers: 3–5 business days. Transfers above R3,000 require FATF Travel Rule compliance.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
