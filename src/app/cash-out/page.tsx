'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, ShieldCheck, Globe, Building2, Loader2,
  CreditCard, ChevronRight, ChevronDown, Wallet, 
  AlertTriangle, Info, Clock, FileText, ArrowLeft, RefreshCw,
  Lock, Zap, Landmark, DatabaseZap, Timer, Shield, XCircle,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { currencies } from '@/lib/currencies';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { doc, collection, serverTimestamp, addDoc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { marketCoins } from '@/lib/data';
<<<<<<< HEAD
import Image from 'next/image';

type WithdrawalMethod = 'eft' | 'swift';
type PageStep = 'details' | 'quote' | 'review' | 'processing' | 'success';
type ProcessingStage = 'received' | 'kyc' | 'quoteLock' | 'onramp' | 'carf' | 'bankClearing' | 'settled';
=======
import { KYCVerificationModal } from '@/components/kyc-verification-modal';
import type { KYCStatus, WithdrawalRequest, AdminNotification } from '@/lib/types';

type WithdrawalMethod = 'eft' | 'swift';
type PageStep = 'details' | 'quote' | 'review' | 'processing' | 'pending_approval' | 'success';
type ProcessingStage = 'received' | 'kyc' | 'quoteLock' | 'submitted';
>>>>>>> refs/remotes/origin/Apex

interface WalletDoc { currency: string; balance: number; }
interface UserDoc { 
  kycStatus?: KYCStatus;
  kycSubmissionId?: string;
}

interface QuoteData {
  lockedPrices: Record<string, number>;
  amountInUSD: number;
  cryptoBreakdown: { symbol: string; amount: number; priceUSD: number; valueUSD: number }[];
  totalCryptoValueUSD: number;
  expiresAt: number;
}

const QUOTE_VALIDITY_SECONDS = 30;

const SA_BANKS: { name: string; branch: string }[] = [
  { name: 'FNB (First National Bank)',  branch: '250655' },
  { name: 'Standard Bank',              branch: '051001' },
  { name: 'Capitec Bank',               branch: '470010' },
  { name: 'Absa Bank',                  branch: '632005' },
  { name: 'Nedbank',                    branch: '198765' },
  { name: 'Investec Bank',              branch: '580105' },
  { name: 'TymeBank',                   branch: '678910' },
  { name: 'Discovery Bank',             branch: '679000' },
];

const FEES = {
<<<<<<< HEAD
  eft:      { networkFee: 15, processingRate: 0.015, label: '1.50%', eta: '1–2 business days',     minAmount: 50,     maxAmount: 500_000 },
  swift:    { networkFee: 250,processingRate: 0.035, label: '3.50% + R250 wire fee', eta: '3–5 business days', minAmount: 1_000, maxAmount: 1_000_000 },
=======
  eft:   { networkFee: 15, processingRate: 0.015, label: '1.50%', eta: '1–2 business days',  minAmount: 50,     maxAmount: 500_000 },
  swift: { networkFee: 250,processingRate: 0.035, label: '3.50% + R250 wire fee', eta: '3–5 business days', minAmount: 1_000, maxAmount: 1_000_000 },
>>>>>>> refs/remotes/origin/Apex
};

const baseSchema = z.object({
  method:      z.enum(['eft', 'swift']),
  accountName: z.string().min(3, 'Full legal name is required'),
  amount:      z.string().refine(v => parseFloat(v) > 0, 'Enter a valid amount'),
  bankName:       z.string().optional(),
  accountNumber:  z.string().optional(),
  branchCode:     z.string().optional(),
  accountType:    z.string().optional(),
  iban:      z.string().optional(),
  swiftCode: z.string().optional(),
  bankCountry: z.string().optional(),
  correspondentBank: z.string().optional(),
});

const schema = baseSchema.superRefine((data, ctx) => {
  const amt = parseFloat(data.amount) || 0;
  const fee = FEES[data.method];
  if (amt < fee.minAmount)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Minimum withdrawal is ${fee.minAmount.toLocaleString()}`, path: ['amount'] });
  if (amt > fee.maxAmount)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Maximum withdrawal is ${fee.maxAmount.toLocaleString()}`, path: ['amount'] });
  if (data.method === 'eft') {
    if (!data.bankName)      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a bank', path: ['bankName'] });
    if (!data.accountNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Account number is required', path: ['accountNumber'] });
    if (!data.accountType)   ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select account type', path: ['accountType'] });
  }
  if (data.method === 'swift') {
    if (!data.iban)        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'IBAN is required', path: ['iban'] });
    if (!data.swiftCode)   ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SWIFT/BIC code is required', path: ['swiftCode'] });
    if (!data.bankCountry) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Destination country is required', path: ['bankCountry'] });
  }
});

type FormValues = z.infer<typeof schema>;

const generateRef = () => {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `APX-${ds}-${String(Math.floor(100000 + Math.random() * 900000))}`;
};

const generateCARFRef = () => {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `CARF-ZA-${ds}-${String(Math.floor(100000 + Math.random() * 900000))}`;
};

export default function CashOutPage() {
  const { toast } = useToast();
  const { user, userProfile, wallet } = useWallet();
  const { currency } = useCurrency();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const paramCurrency = searchParams.get('currency');
  const preferredAsset = paramCurrency && marketCoins.some(c => c.symbol === paramCurrency) ? paramCurrency : null;

  const [step, setStep]         = useState<PageStep>('details');
  const [stage, setStage]       = useState<ProcessingStage>('received');
  const [progress, setProgress] = useState(0);
  const [refNumber, setRefNumber] = useState('');
  const [carfRefNumber, setCarfRefNumber] = useState('');
  const [confirmedData, setConfirmedData] = useState<FormValues | null>(null);
  const [compliance, setCompliance] = useState({
    source: false, fica: false, sars: false, sarb: false, carf: false,
  });

  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [quoteTimeLeft, setQuoteTimeLeft] = useState(QUOTE_VALIDITY_SECONDS);
  const quoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [withdrawCurrencySymbol, setWithdrawCurrencySymbol] = useState(currency.symbol);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  
  // KYC Modal state
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState<KYCStatus>('NOT_SUBMITTED');

  const [fiatRates, setFiatRates] = useState<Record<string, number>>({
    USD: 1, EUR: 0.92, GBP: 0.79, ZAR: 18.62, AUD: 1.53,
    CAD: 1.36, JPY: 149.50, CHF: 0.90, CNY: 7.24, INR: 83.10,
    NGN: 1580.00, BRL: 4.97, MXN: 17.15, SGD: 1.34, HKD: 7.82,
    NZD: 1.63, SEK: 10.45, NOK: 10.52, DKK: 6.87, PLN: 3.95,
  });

  // Fetch user's KYC status
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userData } = useDoc<UserDoc>(userDocRef);
  
  useEffect(() => {
    if (userData?.kycStatus) {
      setKycStatus(userData.kycStatus);
    }
  }, [userData]);

  useEffect(() => {
    const syms = currencies.filter(c => c.symbol !== 'USD').map(c => c.symbol).join(',');
    fetch(`https://api.frankfurter.app/latest?from=USD&to=${syms}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ rates }: { rates: Record<string, number> }) => setFiatRates({ USD: 1, ...rates }))
      .catch(() => {});
  }, []);

  const [livePrices, setLivePrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(marketCoins.map(c => [c.symbol, c.priceUSD]))
  );
  const pricesRef = useRef(livePrices);
  pricesRef.current = livePrices;

  useEffect(() => {
    const symbols = marketCoins.map(c => c.symbol).join(',');
    const load = () => {
      fetch(`/api/prices?symbols=${symbols}&currency=USD`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(({ prices }: { prices: Record<string, number> }) => {
          if (prices && Object.keys(prices).length) setLivePrices(prices);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const walletsColRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'wallets');
  }, [user, firestore]);

  const { data: walletDocs } = useCollection<WalletDoc>(walletsColRef);

  const portfolioUSD = useMemo(() => {
    if (!walletDocs) return 0;
    return walletDocs.reduce((sum, w) => sum + (w.balance * (livePrices[w.currency] ?? 0)), 0);
  }, [walletDocs, livePrices]);

  const withdrawCurrencyInfo = currencies.find(c => c.symbol === withdrawCurrencySymbol) ?? currencies[0];
  const withdrawRate = fiatRates[withdrawCurrencySymbol] ?? 1;
  const availableInWithdrawCurrency = portfolioUSD * withdrawRate;

  const formatWithdrawCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: withdrawCurrencySymbol,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value);
  }, [withdrawCurrencySymbol]);

  const allCompliant = Object.values(compliance).every(Boolean);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      method: 'eft', accountName: '', amount: '',
      bankName: '', accountNumber: '', branchCode: '', accountType: '',
      iban: '', swiftCode: '', bankCountry: '', correspondentBank: '',
    },
    mode: 'onChange',
  });

  const method      = form.watch('method');
  const watchAmount = form.watch('amount');
  const watchBank   = form.watch('bankName');
  const selectedBank = SA_BANKS.find(b => b.name === watchBank);

  const fees = useMemo(() => {
    const val = parseFloat(watchAmount) || 0;
    const cfg = FEES[method];
    const networkFee    = cfg.networkFee;
    const processingFee = val * cfg.processingRate;
    const total         = networkFee + processingFee;
    const net           = Math.max(0, val - total);
    return { networkFee, processingFee, total, net };
  }, [watchAmount, method]);

  const handleFillMax = useCallback(() => {
    const cfg = FEES[method];
    const gross = availableInWithdrawCurrency;
    const netAfterFees = gross - cfg.networkFee - gross * cfg.processingRate;
    const capped = Math.min(Math.max(0, netAfterFees), cfg.maxAmount);
    const gross2 = capped / (1 - cfg.processingRate) + cfg.networkFee;
    const finalGross = Math.min(gross2, cfg.maxAmount, availableInWithdrawCurrency);
    if (finalGross > 0) form.setValue('amount', finalGross.toFixed(2), { shouldValidate: true });
  }, [availableInWithdrawCurrency, method, form]);

  useEffect(() => {
    if (step !== 'quote' || !quoteData) return;
    if (quoteTimerRef.current) clearInterval(quoteTimerRef.current);

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((quoteData.expiresAt - Date.now()) / 1000));
      setQuoteTimeLeft(remaining);
      if (remaining <= 0 && quoteTimerRef.current) clearInterval(quoteTimerRef.current);
    };
    tick();
    quoteTimerRef.current = setInterval(tick, 1000);
    return () => { if (quoteTimerRef.current) clearInterval(quoteTimerRef.current); };
  }, [step, quoteData]);

  const fetchQuote = useCallback(async (data: FormValues) => {
    const symbols = marketCoins.map(c => c.symbol).join(',');
    const res = await fetch(`/api/prices?symbols=${symbols}&currency=USD`, { cache: 'no-store' });
    const lockedPrices: Record<string, number> = res.ok
      ? ((await res.json()) as { prices: Record<string, number> }).prices ?? pricesRef.current
      : pricesRef.current;

    const amountInUSD = parseFloat(data.amount) / withdrawRate;

    const positions = (walletDocs ?? [])
      .map(w => {
        const price = lockedPrices[w.currency] ?? 0;
        return { symbol: w.currency, balance: w.balance, priceUSD: price, valueUSD: w.balance * price };
      })
      .filter(p => p.balance > 0 && p.priceUSD > 0)
      .sort((a, b) => {
        if (preferredAsset) {
          if (a.symbol === preferredAsset && b.symbol !== preferredAsset) return -1;
          if (b.symbol === preferredAsset && a.symbol !== preferredAsset) return 1;
        }
        return b.valueUSD - a.valueUSD;
      });

    let remaining = amountInUSD;
    const breakdown: QuoteData['cryptoBreakdown'] = [];
    for (const pos of positions) {
      if (remaining <= 0) break;
      const usd = Math.min(remaining, pos.valueUSD);
      breakdown.push({ symbol: pos.symbol, amount: usd / pos.priceUSD, priceUSD: pos.priceUSD, valueUSD: usd });
      remaining -= usd;
    }

    setQuoteData({
      lockedPrices,
      amountInUSD,
      cryptoBreakdown: breakdown,
      totalCryptoValueUSD: breakdown.reduce((s, b) => s + b.valueUSD, 0),
      expiresAt: Date.now() + QUOTE_VALIDITY_SECONDS * 1000,
    });
    setQuoteTimeLeft(QUOTE_VALIDITY_SECONDS);
  }, [walletDocs, withdrawRate, preferredAsset]);

  // Check KYC before proceeding to quote
  const handleDetailsSubmit = async (data: FormValues) => {
    // KYC Gate - check if user is approved
    if (kycStatus !== 'APPROVED') {
      setKycModalOpen(true);
      return;
    }

    const amountUSD = parseFloat(data.amount) / withdrawRate;
    if (amountUSD > portfolioUSD + 0.001) {
      form.setError('amount', {
        message: `Exceeds available balance of ${formatWithdrawCurrency(availableInWithdrawCurrency)}`,
      });
      return;
    }
    setConfirmedData(data);
    await fetchQuote(data);
    setStep('quote');
  };

  const handleAcceptQuote = () => {
    if (!quoteData || quoteTimeLeft <= 0) return;
    setStep('review');
    setCompliance({ source: false, fica: false, sars: false, sarb: false, carf: false });
  };

  const handleRefreshQuote = async () => {
    if (!confirmedData) return;
    await fetchQuote(confirmedData);
  };

  const handleConfirm = async () => {
    if (!allCompliant || !confirmedData || !user || !firestore || !walletsColRef || !quoteData) return;

    const ref = generateRef();
    const carf = generateCARFRef();
    setRefNumber(ref);
    setCarfRefNumber(carf);
    setStep('processing');

    setStage('received'); setProgress(10);
    await delay(1200);

    setStage('kyc'); setProgress(35);
    await delay(1800);

    setStage('quoteLock'); setProgress(60);
    await delay(1400);

    setStage('submitted'); setProgress(100);
    
    // Create withdrawal request (pending admin approval)
    const ok = await createWithdrawalRequest(confirmedData, ref, carf);
    if (!ok) return;
<<<<<<< HEAD
    await delay(2400);

    setStage('carf'); setProgress(62);
    await delay(2000);

    setStage('bankClearing'); setProgress(82);
    await delay(2600);

    setStage('settled'); setProgress(100);
    await delay(1000);
    setStep('success');
=======
    
    await delay(800);
    setStep('pending_approval');
>>>>>>> refs/remotes/origin/Apex
  };

  const createWithdrawalRequest = async (data: FormValues, ref: string, carfRef: string): Promise<boolean> => {
    try {
      const lockedPrices = quoteData?.lockedPrices ?? pricesRef.current;
      const amountInUSD = parseFloat(data.amount) / withdrawRate;

      const positions = (walletDocs ?? [])
        .map(w => {
          const price = lockedPrices[w.currency] ?? livePrices[w.currency] ?? 0;
          return { symbol: w.currency, balance: w.balance, priceUSD: price, valueUSD: w.balance * price };
        })
        .filter(p => p.balance > 0 && p.priceUSD > 0)
        .sort((a, b) => {
          if (preferredAsset) {
            if (a.symbol === preferredAsset && b.symbol !== preferredAsset) return -1;
            if (b.symbol === preferredAsset && a.symbol !== preferredAsset) return 1;
          }
          return b.valueUSD - a.valueUSD;
        });

      const totalValueUSD = positions.reduce((sum, p) => sum + p.valueUSD, 0);

      if (amountInUSD > totalValueUSD + 0.001) {
        setStep('details');
        toast({ title: 'Insufficient Balance', description: `Your portfolio value is ${formatWithdrawCurrency(totalValueUSD * withdrawRate)}. Please enter a lower amount.`, variant: 'destructive' });
        return false;
      }

      // Calculate crypto breakdown for the request
      let remainingUSD = amountInUSD;
      const cryptoBreakdown: { symbol: string; amount: number; priceUSD: number }[] = [];
      for (const pos of positions) {
        if (remainingUSD <= 0) break;
        const usdFromThisCoin = Math.min(remainingUSD, pos.valueUSD);
        cryptoBreakdown.push({ 
          symbol: pos.symbol, 
          amount: usdFromThisCoin / pos.priceUSD, 
          priceUSD: pos.priceUSD 
        });
        remainingUSD -= usdFromThisCoin;
      }

      // Create the withdrawal request document
      const withdrawalRequest: Omit<WithdrawalRequest, 'id'> = {
        userId: user!.uid,
        userEmail: userProfile?.email || 'unknown@apex.io',
        walletAddress: wallet?.address || '',
        
        // Use first crypto in breakdown for primary display
        cryptoSymbol: cryptoBreakdown[0]?.symbol || 'USD',
        cryptoAmount: cryptoBreakdown.reduce((sum, c) => sum + c.amount, 0),
        fiatCurrency: withdrawCurrencySymbol,
        fiatAmount: parseFloat(data.amount),
        exchangeRate: withdrawRate,
        networkFee: fees.networkFee,
        
        withdrawalMethod: data.method.toUpperCase() as 'EFT' | 'SWIFT',
        bankName: data.method === 'eft' ? (data.bankName || '') : (data.bankCountry || ''),
        accountNumber: data.method === 'eft' ? (data.accountNumber || '') : (data.iban || ''),
        accountHolder: data.accountName,
        routingNumber: data.method === 'eft' ? data.branchCode : undefined,
        swiftCode: data.method === 'swift' ? data.swiftCode : undefined,
        
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        transactionReference: ref,
      };

<<<<<<< HEAD
      await runTransaction(firestore!, async (tx) => {
        const snapshots = await Promise.all(coinRefs.map(r => tx.get(r)));

        for (let i = 0; i < deductions.length; i++) {
          const snap = snapshots[i];
          if (!snap.exists()) throw new Error(`${deductions[i].symbol} wallet not found.`);
          const current = snap.data().balance as number;
          if (deductions[i].coinAmount > current + 1e-10) throw new Error(`Insufficient ${deductions[i].symbol} balance. Please try again.`);
        }

        for (let i = 0; i < deductions.length; i++) {
          const current = snapshots[i].data()!.balance as number;
          const d = deductions[i];
          const proportion = d.usdContribution / amountInUSD;

          tx.update(coinRefs[i], { balance: current - d.coinAmount });

          const txRef = doc(collection(coinRefs[i], 'transactions'));
          tx.set(txRef, {
            userId:          user!.uid,
            type:            'Withdrawal',
            amount:          d.coinAmount,
            amountFiat:      parseFloat(data.amount) * proportion,
            currency:        withdrawCurrencySymbol,
            netFiat:         fees.net * proportion,
            price:           d.priceUSD,
            timestamp:       serverTimestamp(),
            status:          'Completed',
            referenceNo:     ref,
            carfReference:   carfRef,
            method:          data.method,
            beneficiaryName: data.accountName,
            ...(data.method === 'eft'      && { bankName: data.bankName, accountNumber: data.accountNumber }),
            ...(data.method === 'swift'    && { iban: data.iban, swiftCode: data.swiftCode }),
            compliance: {
              ficaReported: parseFloat(data.amount) >= 24999.99,
              amlCleared: true,
              sarb: data.method === 'swift',
              carfSubmitted: true,
              carfReference: carfRef,
            },
            notes: `Apex Wallet withdrawal — Ref: ${ref} | CARF: ${carfRef}`,
          });
        }
=======
      // Save to withdrawal_requests collection
      await addDoc(collection(firestore!, 'withdrawal_requests'), {
        ...withdrawalRequest,
        cryptoBreakdown, // Store the full breakdown
        carfReference: carfRef,
        netFiatAmount: fees.net,
        compliance: {
          ficaReported: parseFloat(data.amount) >= 24999.99,
          amlCleared: true,
          sarb: data.method === 'swift',
          carfSubmitted: true,
        },
>>>>>>> refs/remotes/origin/Apex
      });

      // Create admin notification
      const notification: Omit<AdminNotification, 'id'> = {
        type: 'WITHDRAWAL_REQUEST',
        title: 'New Withdrawal Request',
        message: `${data.accountName} has requested a withdrawal of ${formatWithdrawCurrency(parseFloat(data.amount))} via ${data.method.toUpperCase()}.`,
        userId: user!.uid,
        userEmail: userProfile?.email,
        referenceId: ref,
        read: false,
        createdAt: serverTimestamp(),
        metadata: {
          amount: parseFloat(data.amount),
          currency: withdrawCurrencySymbol,
          method: data.method,
          netAmount: fees.net,
        },
      };

      await addDoc(collection(firestore!, 'admin_notifications'), notification);

      return true;
    } catch (e: unknown) {
      setStep('details');
      const message = e instanceof Error ? e.message : 'Unable to submit withdrawal request. Please try again.';
      toast({ title: 'Submission Error', description: message, variant: 'destructive' });
      return false;
    }
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const STAGES: { id: ProcessingStage; label: string; sub: string; icon: typeof CheckCircle2 }[] = [
    { id: 'received',   label: 'Request Received',           sub: 'Withdrawal logged on secure ledger',           icon: FileText    },
    { id: 'kyc',        label: 'KYC & AML Verification',     sub: 'Identity and compliance checks passed',        icon: ShieldCheck },
    { id: 'quoteLock',  label: 'Quote Locked & Validated',   sub: 'Exchange rate confirmed at settlement price',  icon: Lock        },
    { id: 'submitted',  label: 'Submitted for Approval',     sub: 'Awaiting administrator review',                icon: Clock       },
  ];

  const stageIdx  = STAGES.findIndex(s => s.id === stage);
  const methodCfg = FEES[method];
  const amountVal = parseFloat(watchAmount) || 0;
  const exceedsBalance = amountVal > availableInWithdrawCurrency && availableInWithdrawCurrency > 0;
  const quoteExpired = quoteTimeLeft <= 0;

  // KYC Status Banner Component
  const KYCStatusBanner = () => {
    if (kycStatus === 'APPROVED') return null;
    
    return (
      <Card className={cn(
        'border-2',
        kycStatus === 'PENDING' ? 'border-amber-500/30 bg-amber-500/5' : 
        kycStatus === 'REJECTED' ? 'border-destructive/30 bg-destructive/5' : 
        'border-primary/30 bg-primary/5'
      )}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
              kycStatus === 'PENDING' ? 'bg-amber-500/15' : 
              kycStatus === 'REJECTED' ? 'bg-destructive/15' : 
              'bg-primary/15'
            )}>
              {kycStatus === 'PENDING' ? (
                <Clock className="h-5 w-5 text-amber-500" />
              ) : kycStatus === 'REJECTED' ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <Shield className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                'text-sm font-semibold',
                kycStatus === 'PENDING' ? 'text-amber-600 dark:text-amber-400' : 
                kycStatus === 'REJECTED' ? 'text-destructive' : 
                'text-primary'
              )}>
                {kycStatus === 'PENDING' ? 'Verification In Progress' : 
                 kycStatus === 'REJECTED' ? 'Verification Required' : 
                 'Identity Verification Required'}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {kycStatus === 'PENDING' 
                  ? 'Your documents are being reviewed. You\'ll be notified once approved.'
                  : kycStatus === 'REJECTED'
                  ? 'Your previous verification was not approved. Please submit new documents.'
                  : 'To comply with financial regulations, please verify your identity before withdrawing.'}
              </p>
              {kycStatus !== 'PENDING' && (
                <Button 
                  size="sm" 
                  className="mt-3 h-8 text-xs"
                  onClick={() => setKycModalOpen(true)}
                >
                  <Shield className="h-3 w-3 mr-1.5" />
                  {kycStatus === 'REJECTED' ? 'Resubmit Documents' : 'Verify Identity'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PrivateRoute>
      <div className="flex justify-center pb-10">
        <div className="w-full max-w-xl space-y-4">

          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">Withdrawal</CardTitle>
                    <CardDescription className="text-[11px]">Withdraw funds to your bank account</CardDescription>
                  </div>
                </div>
                {step === 'details' && (
                  <Badge variant="outline" className="text-[10px] text-accent border-accent/30 bg-accent/5">
                    <div className="h-1.5 w-1.5 rounded-full bg-accent mr-1.5" />
                    Live Rates
                  </Badge>
                )}
                {step === 'quote' && (
                  <Badge variant="outline" className={cn('text-[10px] border-primary/30 bg-primary/5', quoteExpired ? 'text-destructive border-destructive/30 bg-destructive/5' : 'text-primary')}>
                    <Timer className="h-3 w-3 mr-1" />
                    {quoteExpired ? 'Expired' : `${quoteTimeLeft}s`}
                  </Badge>
                )}
                {(step === 'review' || step === 'processing') && (
                  <button
                    onClick={() => step === 'review' && setStep('quote')}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {step === 'review'     && <><ArrowLeft className="h-3 w-3" /> Back to quote</>}
                    {step === 'processing' && <span className="text-primary font-medium">Processing...</span>}
                  </button>
                )}
              </div>
            </CardHeader>
          </Card>

<<<<<<< HEAD
=======
          {/* KYC Status Banner - show on details step */}
          {step === 'details' && <KYCStatusBanner />}

          {/* ══ STEP 1 — DETAILS ═══════════════════════════════════════════════ */}
>>>>>>> refs/remotes/origin/Apex
          {step === 'details' && (
            <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-4">

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5">
<<<<<<< HEAD
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">Withdrawal Method</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([
                      { id: 'eft',      label: 'EFT / Bank Transfer', sub: 'SA Banks — 1–2 days',    icon: Building2  },
                      { id: 'swift',    label: 'International Wire',  sub: 'SWIFT — 3–5 days',       icon: Globe      },
=======
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Withdrawal Method</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { id: 'eft',   label: 'EFT / Bank Transfer', sub: 'SA Banks — 1–2 business days', icon: Building2, secure: true },
                      { id: 'swift', label: 'International Wire',  sub: 'SWIFT — 3–5 business days',    icon: Globe, secure: true },
>>>>>>> refs/remotes/origin/Apex
                    ] as const).map(opt => (
                      <button
                        key={opt.id} type="button"
                        onClick={() => form.setValue('method', opt.id, { shouldValidate: true })}
                        className={cn(
                          'flex flex-col items-start p-4 rounded-xl border text-left transition-all relative overflow-hidden',
                          method === opt.id ? 'bg-primary/10 border-primary/40 shadow-sm' : 'bg-muted/20 border-border/40 hover:border-border'
                        )}
                      >
                        {opt.secure && (
                          <div className="absolute top-2 right-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-accent/60" />
                          </div>
                        )}
                        <opt.icon className={cn('h-5 w-5 mb-2', method === opt.id ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="text-[12px] font-bold leading-tight block">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-1 leading-tight">{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Beneficiary Details</p>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground ml-1">Full Legal Name & Surname</Label>
                    <Input className="h-11 bg-background/50 border-border/60 text-sm rounded-xl" placeholder="e.g. John David Smith" {...form.register('accountName')} />
                    {form.formState.errors.accountName && <p className="text-[11px] text-destructive px-1">{form.formState.errors.accountName.message}</p>}
                    <p className="text-[10px] text-muted-foreground px-1">Must match the registered name on the receiving account (FICA requirement)</p>
                  </div>

                  {method === 'eft' && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground ml-1">Bank</Label>
                        <Select onValueChange={v => {
                          form.setValue('bankName', v, { shouldValidate: true });
                          const b = SA_BANKS.find(x => x.name === v);
                          if (b) form.setValue('branchCode', b.branch, { shouldValidate: true });
                        }}>
                          <SelectTrigger className="h-11 bg-background/50 border-border/60 text-sm rounded-xl"><SelectValue placeholder="Select your bank" /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60">
                            {SA_BANKS.map(b => (
                              <SelectItem key={b.name} value={b.name}>
                                <span>{b.name}</span>
                                <span className="ml-2 text-muted-foreground font-mono text-[11px]">({b.branch})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.bankName && <p className="text-[11px] text-destructive px-1">{form.formState.errors.bankName.message}</p>}
                      </div>
                      {selectedBank && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/20">
                          <Info className="h-3.5 w-3.5 text-accent shrink-0" />
                          <span className="text-[11px] text-muted-foreground">Universal branch code: <span className="font-mono font-bold text-foreground">{selectedBank.branch}</span> — auto-populated</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground ml-1">Account Number</Label>
                          <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm rounded-xl" placeholder="1234567890" {...form.register('accountNumber')} />
                          {form.formState.errors.accountNumber && <p className="text-[11px] text-destructive px-1">{form.formState.errors.accountNumber.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground ml-1">Branch Code</Label>
                          <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm rounded-xl" placeholder="Auto-filled" readOnly {...form.register('branchCode')} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground ml-1">Account Type</Label>
                        <Select onValueChange={v => form.setValue('accountType', v, { shouldValidate: true })}>
                          <SelectTrigger className="h-11 bg-background/50 border-border/60 text-sm rounded-xl"><SelectValue placeholder="Select account type" /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60">
                            <SelectItem value="cheque">Cheque / Current Account</SelectItem>
                            <SelectItem value="savings">Savings Account</SelectItem>
                            <SelectItem value="transmission">Transmission Account</SelectItem>
                          </SelectContent>
                        </Select>
<<<<<<< HEAD
                        {form.formState.errors.accountType && <p className="text-[11px] text-destructive px-1">{form.formState.errors.accountType.message}</p>}
=======
                        {form.formState.errors.accountType && <p className="text-[11px] text-destructive">{form.formState.errors.accountType.message}</p>}
>>>>>>> refs/remotes/origin/Apex
                      </div>
                    </>
                  )}

                  {method === 'swift' && (
                    <>
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          International wire transfers are subject to South African Reserve Bank (SARB) regulations. Your annual Single Discretionary Allowance is <strong className="text-foreground">R1,000,000</strong>. Amounts exceeding this require a SARB Foreign Capital Allowance approval.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground ml-1">IBAN</Label>
                        <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm uppercase rounded-xl" placeholder="e.g. GB29 NWBK 6016 1331 9268 19" {...form.register('iban')} />
                        {form.formState.errors.iban && <p className="text-[11px] text-destructive px-1">{form.formState.errors.iban.message}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground ml-1">SWIFT / BIC Code</Label>
                          <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm uppercase rounded-xl" placeholder="e.g. NWBKGB2L" {...form.register('swiftCode')} />
                          {form.formState.errors.swiftCode && <p className="text-[11px] text-destructive px-1">{form.formState.errors.swiftCode.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground ml-1">Destination Country</Label>
                          <Input className="h-11 bg-background/50 border-border/60 text-sm rounded-xl" placeholder="e.g. United Kingdom" {...form.register('bankCountry')} />
                          {form.formState.errors.bankCountry && <p className="text-[11px] text-destructive px-1">{form.formState.errors.bankCountry.message}</p>}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground ml-1">Correspondent Bank (if applicable)</Label>
                        <Input className="h-11 bg-background/50 border-border/60 text-sm rounded-xl" placeholder="Optional — for intermediary routing" {...form.register('correspondentBank')} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-accent/5 border border-accent/20">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[11px] text-muted-foreground">Available balance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-accent tabular-nums">{formatWithdrawCurrency(availableInWithdrawCurrency)}</span>
                      <button type="button" onClick={handleFillMax} className="text-[10px] font-semibold text-primary hover:text-primary/80 border border-primary/30 rounded-lg px-1.5 py-0.5 transition-colors">MAX</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Withdrawal Amount</p>
                    <span className="text-[11px] text-muted-foreground">
                      Limits: <span className="text-foreground font-medium">{withdrawCurrencySymbol} {methodCfg.minAmount.toLocaleString()} – {withdrawCurrencySymbol} {methodCfg.maxAmount.toLocaleString()}</span>
                    </span>
                  </div>

                  <div className={cn('flex h-14 rounded-xl border overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all', exceedsBalance ? 'border-destructive/60 bg-destructive/5' : 'border-border/60 bg-background/50')}>
                    <Popover open={currencyPickerOpen} onOpenChange={setCurrencyPickerOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="flex items-center gap-2 px-4 border-r border-border/60 text-sm font-bold shrink-0 hover:bg-muted/40 transition-colors min-w-[100px]">
                          <div className="relative h-3 w-4.5 overflow-hidden rounded-sm border border-white/10 shrink-0">
                            <Image src={withdrawCurrencyInfo.flagUrl} alt={withdrawCurrencyInfo.name} fill className="object-cover" />
                          </div>
                          <span className="tabular-nums">{withdrawCurrencySymbol}</span>
                          <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-auto" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-2 rounded-xl border-border/60" sideOffset={4}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-1.5 pt-1">Select currency</p>
                        <div className="max-h-60 overflow-y-auto space-y-0.5 scroll-container">
                          {currencies.map(c => (
                            <button key={c.symbol} type="button"
                              onClick={() => { setWithdrawCurrencySymbol(c.symbol); setCurrencyPickerOpen(false); }}
                              className={cn('w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left', withdrawCurrencySymbol === c.symbol && 'bg-primary/10 text-primary font-medium')}
                            >
                              <div className="relative h-3 w-4.5 overflow-hidden rounded-sm border border-white/5 shrink-0">
                                <Image src={c.flagUrl} alt={c.name} fill className="object-cover" />
                              </div>
                              <span className="font-bold w-10 tabular-nums">{c.symbol}</span>
                              <span className="text-muted-foreground text-[11px] truncate">{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <div className="flex-1 relative">
                      <Input className="h-full border-0 bg-transparent pl-4 pr-4 text-2xl font-bold tracking-tight flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none tabular-nums" type="number" step="any" placeholder="0.00" {...form.register('amount')} />
                    </div>
                  </div>

                  {exceedsBalance && (
                    <p className="text-[11px] text-destructive flex items-center gap-1.5 px-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Amount exceeds your available balance of {formatWithdrawCurrency(availableInWithdrawCurrency)}
                    </p>
                  )}
                  {form.formState.errors.amount && !exceedsBalance && <p className="text-[11px] text-destructive px-1">{form.formState.errors.amount.message}</p>}

                  {amountVal >= methodCfg.minAmount && amountVal <= availableInWithdrawCurrency && (
                    <div className="rounded-xl border border-border/50 bg-background/30 divide-y divide-border/30 overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-3 text-[12px]">
                        <span className="text-muted-foreground">Gross amount</span>
                        <span className="font-bold tabular-nums">{formatWithdrawCurrency(amountVal)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 text-[12px]">
                        <span className="text-muted-foreground">Network fee</span>
<<<<<<< HEAD
                        <span className="text-destructive/80 font-medium tabular-nums">− {formatWithdrawCurrency(fees.networkFee)}</span>
=======
                        <span className="text-destructive/80">- {formatWithdrawCurrency(fees.networkFee)}</span>
>>>>>>> refs/remotes/origin/Apex
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 text-[12px]">
                        <span className="text-muted-foreground">Apex service fee ({methodCfg.label})</span>
<<<<<<< HEAD
                        <span className="text-destructive/80 font-medium tabular-nums">− {formatWithdrawCurrency(fees.processingFee)}</span>
=======
                        <span className="text-destructive/80">- {formatWithdrawCurrency(fees.processingFee)}</span>
>>>>>>> refs/remotes/origin/Apex
                      </div>
                      <div className="flex justify-between items-center px-4 py-4 text-[13px] bg-accent/5">
                        <span className="font-bold text-accent uppercase tracking-widest text-[10px]">Settlement Estimate</span>
                        <span className="font-black text-accent text-lg tabular-nums">{formatWithdrawCurrency(fees.net)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-1">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Estimated settlement: <strong className="text-foreground">{methodCfg.eta}</strong> (after admin approval)</span>
                  </div>
                </CardContent>
              </Card>

<<<<<<< HEAD
              <Button type="submit" className="w-full h-14 rounded-2xl font-bold tracking-widest uppercase text-xs btn-premium" disabled={!form.formState.isValid || exceedsBalance || availableInWithdrawCurrency <= 0}>
                Fetch Verified Quote <ChevronRight className="ml-2 h-4 w-4" />
=======
              <Button type="submit" className="w-full h-12 font-semibold tracking-wide" disabled={!form.formState.isValid || exceedsBalance || availableInWithdrawCurrency <= 0}>
                {kycStatus !== 'APPROVED' ? (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Verify Identity to Continue
                  </>
                ) : (
                  <>
                    Get Live Quote <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
>>>>>>> refs/remotes/origin/Apex
              </Button>
            </form>
          )}

          {/* ══ STEP 2 — LIVE QUOTE ════════════════════════════════════════════ */}
          {step === 'quote' && confirmedData && quoteData && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Verified Settlement Quote</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Zap className="h-3 w-3 text-primary" />
                      <span className="font-bold">Apex Private Ledger</span>
                    </div>
                  </div>

                  <div className="text-center py-6">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Payout Volume</p>
                    <p className="text-4xl font-black tracking-tighter tabular-nums">{formatWithdrawCurrency(parseFloat(confirmedData.amount))}</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] border-white/10 bg-white/5 text-muted-foreground rounded-lg h-6">
                        ≈ ${quoteData.amountInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </Badge>
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Liquidation Rail Settlement</p>
                    {quoteData.cryptoBreakdown.map(b => {
                      const coinName = marketCoins.find(c => c.symbol === b.symbol)?.name ?? b.symbol;
                      return (
                        <div key={b.symbol} className="flex items-center justify-between px-4 py-3 rounded-xl bg-background/30 border border-border/30">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                              <CryptoIcon name={coinName} className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[12px] font-bold leading-none mb-1">{coinName}</p>
                              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">{b.symbol} identity rail</p>
                            </div>
                          </div>
                          <div className="text-right">
<<<<<<< HEAD
                            <p className="text-[12px] font-black tabular-nums">{b.amount.toFixed(b.symbol === 'BTC' ? 8 : 6)} {b.symbol}</p>
                            <p className="text-[10px] text-muted-foreground font-medium tabular-nums">@ ${b.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
=======
                            <p className="text-[12px] font-bold tabular-nums">{(b.amount ?? 0).toFixed(b.symbol === 'BTC' ? 8 : 6)} {b.symbol}</p>
                            <p className="text-[10px] text-muted-foreground">@ ${b.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
>>>>>>> refs/remotes/origin/Apex
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator className="opacity-30" />

<<<<<<< HEAD
                  <div className="rounded-xl border border-border/50 bg-background/30 divide-y divide-border/30 overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 text-[12px]">
                      <span className="text-muted-foreground">Total Payout Volume</span>
                      <span className="font-bold tabular-nums">{formatWithdrawCurrency(parseFloat(confirmedData.amount))}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3 text-[12px]">
                      <span className="text-muted-foreground">Aggregate Network Fees</span>
                      <span className="text-destructive/80 font-bold tabular-nums">− {formatWithdrawCurrency(fees.total)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-4 text-[13px] bg-accent/10">
                      <span className="font-black text-accent uppercase tracking-widest text-[10px]">Net Settlement Credit</span>
                      <span className="font-black text-accent text-xl tabular-nums">{formatWithdrawCurrency(fees.net)}</span>
=======
                  <div className="rounded-xl border border-border/50 bg-background/30 divide-y divide-border/30">
                    <div className="flex justify-between items-center px-4 py-2.5 text-[12px]">
                      <span className="text-muted-foreground">Gross (crypto equivalent)</span>
                      <span className="font-medium">{quoteData.cryptoBreakdown.length === 1
                        ? `${(quoteData.cryptoBreakdown[0].amount ?? 0).toFixed(quoteData.cryptoBreakdown[0].symbol === 'BTC' ? 8 : 6)} ${quoteData.cryptoBreakdown[0].symbol}`
                        : `≈ $${quoteData.amountInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${quoteData.cryptoBreakdown.length} assets`
                      }</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 text-[12px]">
                      <span className="text-muted-foreground">Total Fees</span>
                      <span className="text-destructive/80">- {formatWithdrawCurrency(fees.total)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 text-[12px]">
                      <span className="text-muted-foreground">Net (crypto equivalent)</span>
                      <span className="font-medium">{(() => {
                        const netUSD = fees.net / withdrawRate;
                        const netRatio = fees.net / (parseFloat(confirmedData.amount) || 1);
                        if (quoteData.cryptoBreakdown.length === 1) {
                          const b = quoteData.cryptoBreakdown[0];
                          return `${((b.amount ?? 0) * netRatio).toFixed(b.symbol === 'BTC' ? 8 : 6)} ${b.symbol}`;
                        }
                        return `≈ $${netUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${quoteData.cryptoBreakdown.length} assets`;
                      })()}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3 text-[13px] bg-accent/5 rounded-b-xl">
                      <span className="font-semibold text-accent">You will receive</span>
                      <span className="font-bold text-accent text-base">{formatWithdrawCurrency(fees.net)}</span>
>>>>>>> refs/remotes/origin/Apex
                    </div>
                  </div>

                  <div className={cn('flex items-center justify-center gap-3 px-4 py-4 rounded-xl border transition-all duration-500', quoteExpired ? 'bg-destructive/10 border-destructive/30' : 'bg-primary/5 border-primary/30')}>
                    <Timer className={cn('h-4 w-4', quoteExpired ? 'text-destructive animate-pulse' : 'text-primary')} />
                    {quoteExpired ? (
                      <span className="text-[12px] text-destructive font-bold uppercase tracking-widest">Quote Expired — State Root Reconciled</span>
                    ) : (
                      <span className="text-[12px] text-primary font-bold uppercase tracking-widest">
                        Lock-in Window: <span className="tabular-nums text-sm font-black">{quoteTimeLeft}s</span>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest border-border/60" onClick={() => setStep('details')}>
                  <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Re-configure
                </Button>
                {quoteExpired ? (
                  <Button className="h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest btn-premium" onClick={handleRefreshQuote}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh State
                  </Button>
                ) : (
                  <Button className="h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest btn-premium" onClick={handleAcceptQuote}>
                    Accept & Continue <ChevronRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ══ STEP 3 — REVIEW & COMPLIANCE ═══════════════════════════════════ */}
          {step === 'review' && confirmedData && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">Orchestration Summary</p>
                  {[
<<<<<<< HEAD
                    ['Method', method === 'eft' ? 'EFT — Domestic Bank Rail' : 'SWIFT — International Wire Rail'],
                    ['Beneficiary Identity', confirmedData.accountName],
                    ...(method === 'eft' ? [['Destination Institution', confirmedData.bankName ?? ''], ['Account Index', confirmedData.accountNumber ?? ''], ['Branch Index', confirmedData.branchCode ?? '']] : []),
                    ...(method === 'swift' ? [['IBAN Identity', confirmedData.iban ?? ''], ['SWIFT Index', confirmedData.swiftCode ?? ''], ['Jurisdiction', confirmedData.bankCountry ?? '']] : []),
                    ['Gross Settlement', formatWithdrawCurrency(parseFloat(confirmedData.amount))],
                    ['Aggregate Fees', `− ${formatWithdrawCurrency(fees.total)}`],
                    ['Final Payout', formatWithdrawCurrency(fees.net)],
                    ['Settlement ETA', methodCfg.eta],
=======
                    ['Method', method === 'eft' ? 'EFT — South African Bank Transfer' : 'International SWIFT Wire'],
                    ['Beneficiary', confirmedData.accountName],
                    ...(method === 'eft' ? [['Bank', confirmedData.bankName ?? ''], ['Account Number', confirmedData.accountNumber ?? ''], ['Branch Code', confirmedData.branchCode ?? '']] : []),
                    ...(method === 'swift' ? [['IBAN', confirmedData.iban ?? ''], ['SWIFT / BIC', confirmedData.swiftCode ?? ''], ['Destination Country', confirmedData.bankCountry ?? '']] : []),
                    ['Gross Amount', formatWithdrawCurrency(parseFloat(confirmedData.amount))],
                    ['Total Fees', `- ${formatWithdrawCurrency(fees.total)}`],
                    ['Amount to Receive', formatWithdrawCurrency(fees.net)],
                    ['Estimated Settlement', methodCfg.eta],
>>>>>>> refs/remotes/origin/Apex
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-start py-2 border-b border-border/20 last:border-0 px-1">
                      <span className="text-[12px] text-muted-foreground font-medium">{label}</span>
                      <span className={cn('text-[12px] font-bold text-right max-w-[60%] tabular-nums', label === 'Final Payout' && 'text-accent text-[15px]', label === 'Aggregate Fees' && 'text-destructive/80')}>{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Admin Approval Notice */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-primary">Admin Approval Required</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    For your security, all withdrawals require administrator approval before processing. You will be notified once your request has been reviewed.
                  </p>
                </div>
              </div>

              {parseFloat(confirmedData.amount) >= 25000 && (
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-widest text-amber-500 mb-1">Regulatory Threshold Alert</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                      Transaction protocols for volumes ≥ R25,000 necessitate mandatory reporting to the Financial Intelligence Centre (FIC) under section 29 of FICA No. 38 of 2001.
                    </p>
                  </div>
                </div>
              )}

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Compliance Attestation</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed px-1 font-medium">
                    Apex Wallet operates under strict adherence to international AML/KYC frameworks and South African financial statutes. Affirm all declarations to authorize dispatch.
                  </p>
                  {([
                    { key: 'source' as const, title: 'Verified Asset Provenance', text: 'I attest that these assets are derived from legitimate orchestration and are not associated with proceeds of unlawful activities under POCA No. 121 of 1998.' },
                    { key: 'fica' as const, title: 'Identity & AML Consent', text: 'I authorize identity verification and transaction monitoring as required under FICA No. 38 of 2001 for anti-money laundering protocols.' },
                    { key: 'sars' as const, title: 'SARS Tax Acknowledgement', text: 'I acknowledge the taxable nature of crypto-asset disposals under the Income Tax Act No. 58 of 1962 and accept full reporting responsibility.' },
                    { key: 'sarb' as const, title: 'SARB Exchange Governance', text: method === 'swift' ? "I confirm compliance with the SARB Single Discretionary Allowance (R1M limit) or verify possession of valid Foreign Capital Allowance approval." : 'I verify that this domestic settlement complies with SARB exchange control regulations and financial governance rules.' },
                    { key: 'carf' as const, title: 'CARF 2026 Reporting Consent', text: 'I consent to the collection and transmission of transaction metadata to SARS in accordance with the Crypto-Asset Reporting Framework (March 2026).' },
                  ]).map(item => (
                    <div key={item.key} className="flex items-start gap-4 p-4 rounded-2xl bg-background/40 border border-border/40 transition-colors hover:border-primary/30 group">
                      <Checkbox id={item.key} checked={compliance[item.key]} onCheckedChange={v => setCompliance(prev => ({ ...prev, [item.key]: !!v }))} className="mt-0.5 shrink-0 rounded-md border-border/60" />
                      <div>
                        <label htmlFor={item.key} className="text-[12px] font-black uppercase tracking-widest cursor-pointer group-hover:text-primary transition-colors">{item.title}</label>
                        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed font-medium">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

<<<<<<< HEAD
              <Button onClick={handleConfirm} disabled={!allCompliant} className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] italic text-xs btn-premium shadow-xl shadow-primary/20">
                <ShieldCheck className="mr-2 h-4 w-4" /> Authorize & Dispatch Liquidity
              </Button>

              <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-6 font-bold uppercase opacity-40">
                Authorized administrative signatures will be applied to this ledger state update. Operations are final.
=======
              <Button onClick={handleConfirm} disabled={!allCompliant} className="w-full h-12 font-semibold tracking-wide">
                <ShieldCheck className="mr-2 h-4 w-4" /> Submit for Approval
              </Button>

              <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-4">
                By submitting, you agree to Apex Wallet&apos;s Terms of Service and Privacy Policy. Your withdrawal will be processed after admin approval.
>>>>>>> refs/remotes/origin/Apex
              </p>
            </div>
          )}

          {/* ══ STEP 4 — PROCESSING ════════════════════════════════════════════ */}
          {step === 'processing' && (
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
              <CardContent className="pt-10 pb-10">
                <div className="text-center mb-10">
                  <div className="relative h-20 w-20 mx-auto mb-6">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                    <div className="relative h-20 w-20 rounded-3xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                      <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    </div>
                  </div>
<<<<<<< HEAD
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Executing Ledger Payout</h3>
                  <p className="text-[11px] text-muted-foreground mt-2 font-bold uppercase tracking-widest opacity-60">System Index: <span className="font-mono text-foreground">{refNumber}</span></p>
=======
                  <h3 className="text-base font-bold">Submitting Your Request</h3>
                  <p className="text-[12px] text-muted-foreground mt-1">Reference: <span className="font-mono font-semibold text-foreground">{refNumber}</span></p>
>>>>>>> refs/remotes/origin/Apex
                </div>

                <div className="px-4 mb-10">
                  <Progress value={progress} className="h-2 bg-white/5 rounded-full" />
                </div>

                <div className="space-y-3 px-2">
                  {STAGES.map((s, idx) => {
                    const passed = stageIdx >= idx;
                    const active = stageIdx === idx;
                    return (
                      <div key={s.id} className={cn('flex items-center gap-5 p-4 rounded-2xl border transition-all duration-700',
                        active ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/10' : passed ? 'bg-accent/5 border-accent/20 opacity-100' : 'opacity-20 grayscale border-transparent'
                      )}>
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500',
                          active ? 'bg-primary text-primary-foreground scale-110' : passed ? 'bg-accent/20 text-accent' : 'bg-muted/30 text-muted-foreground'
                        )}>
                          {active ? <Loader2 className="h-5 w-5 animate-spin" /> : <s.icon className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className={cn('text-[12px] font-black uppercase tracking-widest', passed ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter truncate opacity-60 mt-0.5">{s.sub}</p>
                        </div>
                        {passed && !active && <CheckCircle2 className="h-5 w-5 text-accent ml-auto shrink-0 animate-in zoom-in duration-300" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

<<<<<<< HEAD
          {/* ══ STEP 5 — SUCCESS ═══════════════════════════════════════════════ */}
          {step === 'success' && confirmedData && (
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
              <CardContent className="pt-12 pb-10">
                <div className="text-center space-y-3 mb-10">
                  <div className="relative h-24 w-24 mx-auto mb-6">
                    <div className="absolute inset-0 bg-accent/20 rounded-full blur-3xl animate-pulse" />
                    <div className="relative h-24 w-24 rounded-full bg-accent/15 border-4 border-accent/30 flex items-center justify-center shadow-2xl shadow-accent/20">
                      <CheckCircle2 className="h-12 w-12 text-accent" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">Liquidity Dispatched</h3>
                  <p className="text-[11px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-60">Verified Settlement Authorization Successful</p>
=======
          {/* ══ STEP 5 — PENDING APPROVAL ═══════════════════════════════════════ */}
          {step === 'pending_approval' && confirmedData && (
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-8 pb-8">
                <div className="text-center space-y-2 mb-8">
                  <div className="h-16 w-16 rounded-full bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
                    <Clock className="h-8 w-8 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold">Awaiting Admin Approval</h3>
                  <p className="text-[12px] text-muted-foreground">Your withdrawal request has been submitted for review</p>
>>>>>>> refs/remotes/origin/Apex
                </div>

                <div className="grid grid-cols-1 gap-3 mb-8">
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 text-center shadow-lg shadow-primary/5">
                    <p className="text-[10px] uppercase font-black tracking-[0.3em] text-primary/60 mb-2">Ledger Reference Index</p>
                    <p className="font-mono font-black text-2xl tracking-widest text-white">{refNumber}</p>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center shadow-lg shadow-emerald-500/5">
                    <p className="text-[10px] uppercase font-black tracking-[0.3em] text-emerald-400/60 mb-2">SARS CARF Compliance Rail</p>
                    <p className="font-mono font-black text-sm tracking-widest text-emerald-400 uppercase">{carfRefNumber}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.02] divide-y divide-white/5 mb-8 overflow-hidden">
                  {[
<<<<<<< HEAD
                    ['Dispatched Volume', formatWithdrawCurrency(parseFloat(confirmedData.amount))],
                    ['Settlement Credit', formatWithdrawCurrency(fees.net)],
                    ['Payout Channel', method === 'eft' ? 'Domestic EFT Rail' : 'International SWIFT Rail'],
                    ['Beneficiary Identity', confirmedData.accountName],
                    ['Expected Finality', methodCfg.eta],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center px-5 py-4">
                      <span className="text-[11px] uppercase font-black tracking-widest text-muted-foreground/60">{label}</span>
                      <span className={cn('text-sm font-black tabular-nums', label === 'Settlement Credit' && 'text-accent text-lg')}>{value}</span>
=======
                    ['Amount Submitted', formatWithdrawCurrency(parseFloat(confirmedData.amount))],
                    ['Amount to Receive', formatWithdrawCurrency(fees.net)],
                    ['Method', method === 'eft' ? 'EFT Bank Transfer' : 'International SWIFT Wire'],
                    ['Status', 'Pending Admin Approval'],
                    ['Estimated Processing', `${methodCfg.eta} (after approval)`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center px-4 py-3 text-[12px]">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn('font-medium', 
                        label === 'Amount to Receive' && 'text-accent font-bold',
                        label === 'Status' && 'text-amber-500 font-semibold'
                      )}>{value}</span>
>>>>>>> refs/remotes/origin/Apex
                    </div>
                  ))}
                </div>

<<<<<<< HEAD
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-10">
                  <Info className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-amber-500 mb-1.5">Tax Protocol Reminder</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed font-bold opacity-80 uppercase tracking-tighter">
                      Retain indices {refNumber} and {carfRefNumber} for verified SARS declaration. Asset disposals are reconciled against the March 2026 CARF framework.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button onClick={() => { setStep('details'); form.reset(); setCompliance({ source: false, fica: false, sars: false, sarb: false, carf: false }); setQuoteData(null); }} className="w-full h-16 rounded-2xl font-black uppercase tracking-widest text-xs btn-premium">
                    Initiate New Dispatch
                  </Button>
                  <p className="text-center text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-40">
                    Governance Support: <span className="text-foreground">support@apexwallet.io</span>
                  </p>
                </div>
=======
                <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/40 mb-6">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-foreground">What happens next?</p>
                    <ul className="text-[11px] text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                      <li>Your withdrawal request is now in the admin review queue</li>
                      <li>Once approved, your crypto will be debited and funds sent</li>
                      <li>You will receive a notification when approved or if additional info is needed</li>
                      <li>If rejected, your balance will remain unchanged</li>
                    </ul>
                  </div>
                </div>

                <Button asChild className="w-full h-12 font-semibold">
                  <a href="/dashboard">Return to Dashboard</a>
                </Button>
>>>>>>> refs/remotes/origin/Apex
              </CardContent>
            </Card>
          )}

<<<<<<< HEAD
          {step === 'details' && (
            <div className="px-2 pb-4">
              <Separator className="opacity-10 mb-4" />
              <p className="text-[9px] text-muted-foreground/40 leading-relaxed text-center font-bold uppercase tracking-tighter">
                Apex Wallet governance protocols align with FICA No. 38 (2001), SARB Currency Act No. 9 (1933), SARS Income Tax Act No. 58 (1962), and the global CARF framework (March 2026). All payouts are subject to automated verified reconciliation. Apex Wallet operates as a self-custodial orchestration interface.
              </p>
            </div>
=======
          {/* ══ STEP 6 — SUCCESS (after admin approval - shown via notification) ═══ */}
          {step === 'success' && confirmedData && (
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-8 pb-8">
                <div className="text-center space-y-2 mb-8">
                  <div className="h-16 w-16 rounded-full bg-accent/15 border-2 border-accent/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/10">
                    <CheckCircle2 className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold">Withdrawal Approved</h3>
                  <p className="text-[12px] text-muted-foreground">Your withdrawal has been approved and is being processed</p>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Transaction Reference</p>
                  <p className="font-mono font-bold text-lg tracking-widest text-primary">{refNumber}</p>
                </div>

                <Button asChild className="w-full h-12 font-semibold">
                  <a href="/dashboard">Return to Dashboard</a>
                </Button>
              </CardContent>
            </Card>
>>>>>>> refs/remotes/origin/Apex
          )}

        </div>
      </div>

      {/* KYC Verification Modal */}
      <KYCVerificationModal
        open={kycModalOpen}
        onOpenChange={setKycModalOpen}
        kycStatus={kycStatus}
        onSubmissionComplete={() => {
          setKycStatus('PENDING');
        }}
      />
    </PrivateRoute>
  );
}
