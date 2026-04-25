'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { RiskDisclaimer } from '@/components/risk-disclaimer';
import {
  CheckCircle2, ShieldCheck, Globe, Building2, Loader2,
  CreditCard, ChevronRight, ChevronDown, Wallet, 
  AlertTriangle, Info, Clock, FileText, ArrowLeft, RefreshCw,
  Lock, Zap, Timer, Shield, XCircle,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { currencies } from '@/lib/currencies';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { doc, collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { marketCoins } from '@/lib/data';
import { KYCVerificationModal } from '@/components/kyc-verification-modal';
import type { KYCStatus, WithdrawalRequest, AdminNotification } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { CryptoIcon } from '@/components/crypto-icon';
import { WithdrawalHistory } from '@/components/withdrawal-history';

type WithdrawalMethod = 'eft' | 'swift';
type PageStep = 'details' | 'quote' | 'review' | 'processing' | 'pending_approval' | 'success';
type ProcessingStage = 'received' | 'kyc' | 'quoteLock' | 'submitted';

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
  eft:   { networkFee: 15, processingRate: 0.015, label: '1.50%', eta: '1–2 business days',  minAmount: 50,     maxAmount: 500_000 },
  swift: { networkFee: 250,processingRate: 0.035, label: '3.50% + R250 wire fee', eta: '3–5 business days', minAmount: 1_000, maxAmount: 1_000_000 },
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

function WithdrawalContent() {
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
  const [withdrawalIntent, setWithdrawalIntent] = useState<{ amount: string; currency: string; method: 'EFT' | 'SWIFT' } | null>(null);

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

  const handleDetailsSubmit = async (data: FormValues) => {
    if (kycStatus !== 'APPROVED') {
      // Capture what the user was trying to withdraw so admin sees the full context
      setWithdrawalIntent({
        amount: data.amount,
        currency: withdrawCurrencySymbol,
        method: data.method === 'eft' ? 'EFT' : 'SWIFT',
      });
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
    if (!allCompliant || !confirmedData || !user || !firestore || !walletsColRef || !quoteData) {
      return;
    }

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
    
    const ok = await createWithdrawalRequest(confirmedData, ref, carf);
    if (!ok) return;
    
    await delay(800);
    setStep('pending_approval');
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

      // Build withdrawal request without undefined fields (Firestore doesn't accept undefined)
      const withdrawalRequest: Omit<WithdrawalRequest, 'id'> = {
        userId: user!.uid,
        userEmail: userProfile?.email || 'unknown@apex.io',
        walletAddress: wallet?.address || '',
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
        // Only include routing-specific fields when they have values
        ...(data.method === 'eft' && data.branchCode ? { routingNumber: data.branchCode } : {}),
        ...(data.method === 'swift' && data.swiftCode ? { swiftCode: data.swiftCode } : {}),
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        transactionReference: ref,
      };

      const withdrawalDocRef = await addDoc(collection(firestore!, 'withdrawal_requests'), {
        ...withdrawalRequest,
        cryptoBreakdown,
        carfReference: carfRef,
        netFiatAmount: fees.net,
        compliance: {
          ficaReported: parseFloat(data.amount) >= 24999.99,
          amlCleared: true,
          sarb: data.method === 'swift',
          carfSubmitted: true,
        },
      });

      // Attempt to create admin notification, but don't fail the submission if it fails
      // The admin_notifications collection can only be written to by admins
      // A Cloud Function trigger on withdrawal_requests will handle this in production
      try {
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
      } catch (notificationError) {
        // Log notification error but don't fail the withdrawal submission
        console.log('[v0] Notification creation failed (will be handled by Cloud Function):', notificationError);
      }

      return true;
    } catch (e: unknown) {
      setStep('details');
      const message = e instanceof Error ? e.message : 'Unable to submit withdrawal request. Please try again.';
      toast({ title: 'Submission Error', description: message, variant: 'destructive' });
      return false;
    }
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const STAGES: { id: ProcessingStage; label: string; sub: string; icon: any }[] = [
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
                <Button size="sm" className="mt-3 h-8 text-xs" onClick={() => setKycModalOpen(true)}>
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
    <div className="flex justify-center pb-10">
      <div className="w-full max-w-xl space-y-4">
        <RiskDisclaimer variant="withdrawal" collapsible />
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
                <button onClick={() => step === 'review' && setStep('quote')} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  {step === 'review'     && <><ArrowLeft className="h-3 w-3" /> Back to quote</>}
                  {step === 'processing' && <span className="text-primary font-medium">Processing...</span>}
                </button>
              )}
            </div>
          </CardHeader>
        </Card>

        {step === 'details' && <KYCStatusBanner />}

        {step === 'details' && (
          <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-4">
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-5 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">Withdrawal Method</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    { id: 'eft',   label: 'EFT / Bank Transfer', sub: 'SA Banks — 1–2 business days', icon: Building2, secure: true },
                    { id: 'swift', label: 'International Wire',  sub: 'SWIFT — 3–5 business days',    icon: Globe, secure: true },
                  ] as const).map(opt => (
                    <button key={opt.id} type="button" onClick={() => form.setValue('method', opt.id, { shouldValidate: true })}
                      className={cn('flex flex-col items-start p-4 rounded-xl border text-left transition-all relative overflow-hidden',
                        method === opt.id ? 'bg-primary/10 border-primary/40 shadow-sm' : 'bg-muted/20 border-border/40 hover:border-border')}>
                      {opt.secure && <div className="absolute top-2 right-2"><ShieldCheck className="h-3.5 w-3.5 text-accent/60" /></div>}
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
                      {form.formState.errors.accountType && <p className="text-[11px] text-destructive px-1">{form.formState.errors.accountType.message}</p>}
                    </div>
                  </>
                )}
                {method === 'swift' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-muted-foreground ml-1">IBAN</Label>
                      <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm uppercase rounded-xl" placeholder="e.g. GB29 NWBK..." {...form.register('iban')} />
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
                      {currencies.map(c => (
                        <button key={c.symbol} type="button" onClick={() => { setWithdrawCurrencySymbol(c.symbol); setCurrencyPickerOpen(false); }}
                          className={cn('w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left', withdrawCurrencySymbol === c.symbol && 'bg-primary/10 text-primary font-medium')}>
                          <div className="relative h-3 w-4.5 overflow-hidden rounded-sm border border-white/5 shrink-0">
                            <Image src={c.flagUrl} alt={c.name} fill className="object-cover" />
                          </div>
                          <span className="font-bold w-10 tabular-nums">{c.symbol}</span>
                          <span className="text-muted-foreground text-[11px] truncate">{c.name}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <Input className="h-full border-0 bg-transparent pl-4 pr-4 text-2xl font-bold tracking-tight flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none tabular-nums" type="number" step="any" placeholder="0.00" {...form.register('amount')} />
                </div>
                {amountVal >= methodCfg.minAmount && amountVal <= availableInWithdrawCurrency && (
                  <div className="rounded-xl border border-border/50 bg-background/30 divide-y divide-border/30 overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 text-[12px]"><span className="text-muted-foreground">Gross amount</span><span className="font-bold tabular-nums">{formatWithdrawCurrency(amountVal)}</span></div>
                    <div className="flex justify-between items-center px-4 py-3 text-[12px]"><span className="text-muted-foreground">Network fee</span><span className="text-destructive/80 font-medium tabular-nums">− {formatWithdrawCurrency(fees.networkFee)}</span></div>
                    <div className="flex justify-between items-center px-4 py-4 text-[13px] bg-accent/5"><span className="font-bold text-accent uppercase tracking-widest text-[10px]">Settlement Estimate</span><span className="font-black text-accent text-lg tabular-nums">{formatWithdrawCurrency(fees.net)}</span></div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Button type="submit" className="w-full h-12 font-semibold" disabled={!form.formState.isValid || exceedsBalance || availableInWithdrawCurrency <= 0}>
              {kycStatus !== 'APPROVED' ? <><Shield className="mr-2 h-4 w-4" /> Verify Identity to Continue</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Get Live Quote <ChevronRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>
        )}

        {step === 'quote' && confirmedData && quoteData && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-5 pb-5 space-y-4">
                <div className="text-center py-6">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Payout Volume</p>
                  <p className="text-4xl font-black tracking-tighter tabular-nums">{formatWithdrawCurrency(parseFloat(confirmedData.amount))}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Liquidation Rail Settlement</p>
                  {quoteData.cryptoBreakdown.map(b => (
                    <div key={b.symbol} className="flex items-center justify-between px-4 py-3 rounded-xl bg-background/30 border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20"><CryptoIcon name={marketCoins.find(c => c.symbol === b.symbol)?.name ?? b.symbol} className="h-4 w-4" /></div>
                        <div><p className="text-[12px] font-bold leading-none mb-1">{b.symbol}</p></div>
                      </div>
                      <div className="text-right"><p className="text-[12px] font-black tabular-nums">{b.amount.toFixed(6)} {b.symbol}</p></div>
                    </div>
                  ))}
                </div>
                <div className={cn('flex items-center justify-center gap-3 px-4 py-4 rounded-xl border', quoteExpired ? 'bg-destructive/10 border-destructive/30' : 'bg-primary/5 border-primary/30')}>
                  <Timer className={cn('h-4 w-4', quoteExpired ? 'text-destructive animate-pulse' : 'text-primary')} />
                  <span className="text-[12px] font-bold uppercase tracking-widest">{quoteExpired ? 'Quote Expired' : `Lock-in Window: ${quoteTimeLeft}s`}</span>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 rounded-xl" onClick={() => setStep('details')}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              {quoteExpired ? <Button className="h-12 rounded-xl" onClick={handleRefreshQuote}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button> : <Button className="h-12 rounded-xl" onClick={handleAcceptQuote}>Continue <ChevronRight className="ml-2 h-4 w-4" /></Button>}
            </div>
          </div>
        )}

        {step === 'review' && confirmedData && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-5 pb-5 space-y-3">
                {[
                  ['Method', method === 'eft' ? 'EFT Transfer' : 'International Wire'],
                  ['Beneficiary', confirmedData.accountName],
                  ['Final Payout', formatWithdrawCurrency(fees.net)],
                  ['Settlement ETA', methodCfg.eta],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start py-2 border-b border-border/20 last:border-0 px-1">
                    <span className="text-[12px] text-muted-foreground font-medium">{label}</span>
                    <span className="text-[12px] font-bold text-right">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="space-y-3">
              {([
                { key: 'source' as const, title: 'Verified Asset Provenance', text: 'I attest that these assets are derived from legitimate orchestration.' },
                { key: 'fica' as const, title: 'Identity & AML Consent', text: 'I authorize identity verification and transaction monitoring.' },
                { key: 'sars' as const, title: 'SARS Tax Acknowledgement', text: 'I acknowledge the taxable nature of crypto-asset disposals.' },
                { key: 'sarb' as const, title: 'SARB Exchange Governance', text: 'I confirm compliance with local and international financial governance.' },
                { key: 'carf' as const, title: 'CARF Reporting Consent', text: 'I consent to the reporting of transaction metadata to SARS.' },
              ]).map(item => (
                <div key={item.key} className="flex items-start gap-4 p-4 rounded-xl bg-background/40 border border-border/40 transition-colors hover:border-primary/30 group">
                  <Checkbox id={item.key} checked={compliance[item.key]} onCheckedChange={v => setCompliance(prev => ({ ...prev, [item.key]: !!v }))} className="mt-0.5 shrink-0 rounded-md border-border/60" />
                  <div>
                    <label htmlFor={item.key} className="text-[12px] font-black uppercase tracking-widest cursor-pointer group-hover:text-primary transition-colors">{item.title}</label>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed font-medium">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleConfirm} disabled={!allCompliant} className="w-full h-14 rounded-xl font-black uppercase tracking-[0.2em] italic text-xs btn-premium">
              <ShieldCheck className="mr-2 h-4 w-4" /> Authorize & Submit
            </Button>
          </div>
        )}

        {step === 'processing' && (
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
            <CardContent className="pt-10 pb-10">
              <div className="text-center mb-10">
                <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Executing Ledger Payout</h3>
                <p className="text-[11px] text-muted-foreground mt-2 font-bold uppercase tracking-widest opacity-60">System Index: <span className="font-mono text-foreground">{refNumber}</span></p>
              </div>
              <Progress value={progress} className="h-2 bg-white/5 rounded-full mb-10" />
              <div className="space-y-3 px-2">
                {STAGES.map((s, idx) => {
                  const passed = stageIdx >= idx;
                  const active = stageIdx === idx;
                  return (
                    <div key={s.id} className={cn('flex items-center gap-5 p-4 rounded-xl border transition-all duration-700', active ? 'bg-primary/10 border-primary/40' : passed ? 'bg-accent/5 border-accent/20' : 'opacity-20 grayscale border-transparent')}>
                      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', active ? 'bg-primary text-primary-foreground' : passed ? 'bg-accent/20 text-accent' : 'bg-muted/30 text-muted-foreground')}>
                        {active ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-black uppercase tracking-widest">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter truncate opacity-60 mt-0.5">{s.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'pending_approval' && confirmedData && (
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardContent className="pt-12 pb-10">
              <div className="text-center space-y-3 mb-10">
                <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-4" />
                <h3 className="text-xl font-bold">Request Submitted</h3>
                <p className="text-[12px] text-muted-foreground">Your withdrawal is awaiting administrative review.</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 text-center mb-8">
                <p className="text-[10px] uppercase font-black tracking-[0.3em] text-primary/60 mb-2">Ledger Reference Index</p>
                <p className="font-mono font-black text-2xl tracking-widest text-white">{refNumber}</p>
              </div>
              <Button asChild className="w-full h-12 font-semibold"><a href="/">Return to Dashboard</a></Button>
            </CardContent>
          </Card>
        )}

        {/* Show withdrawal history on details and pending_approval steps */}
        {(step === 'details' || step === 'pending_approval') && (
          <WithdrawalHistory />
        )}
      </div>

      <KYCVerificationModal
        open={kycModalOpen}
        onOpenChange={setKycModalOpen}
        kycStatus={kycStatus}
        onSubmissionComplete={() => setKycStatus('PENDING')}
        withdrawalContext={withdrawalIntent ?? undefined}
      />
    </div>
  );
}

export default function CashOutPage() {
  return (
    <PrivateRoute>
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <WithdrawalContent />
      </Suspense>
    </PrivateRoute>
  );
}
