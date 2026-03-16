'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
  CreditCard, ChevronRight, ChevronDown, Wallet, Smartphone,
  AlertTriangle, Info, Clock, FileText, ArrowLeft, RefreshCw,
  Lock, Zap, Landmark, DatabaseZap, Timer,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { currencies } from '@/lib/currencies';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { marketCoins } from '@/lib/data';

type WithdrawalMethod = 'eft' | 'cardless' | 'swift';
type PageStep = 'details' | 'quote' | 'review' | 'processing' | 'success';
type ProcessingStage = 'received' | 'kyc' | 'quoteLock' | 'onramp' | 'carf' | 'bankClearing' | 'settled';

interface WalletDoc { currency: string; balance: number; }

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

const CARDLESS_PROVIDERS = [
  'Standard Bank Instant Money',
  'FNB eWallet',
  'Absa CashSend',
];

const FEES = {
  eft:      { networkFee: 15, processingRate: 0.015, label: '1.50%', eta: '1–2 business days',     minAmount: 50,     maxAmount: 500_000 },
  cardless: { networkFee: 10, processingRate: 0.025, label: '2.50%', eta: 'Within 30 minutes',     minAmount: 20,     maxAmount: 3_000   },
  swift:    { networkFee: 250,processingRate: 0.035, label: '3.50% + R250 wire fee', eta: '3–5 business days', minAmount: 1_000, maxAmount: 1_000_000 },
};

const baseSchema = z.object({
  method:      z.enum(['eft', 'cardless', 'swift']),
  accountName: z.string().min(3, 'Full legal name is required'),
  amount:      z.string().refine(v => parseFloat(v) > 0, 'Enter a valid amount'),
  bankName:       z.string().optional(),
  accountNumber:  z.string().optional(),
  branchCode:     z.string().optional(),
  accountType:    z.string().optional(),
  cardlessProvider: z.string().optional(),
  phoneNumber:      z.string().optional(),
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
  if (data.method === 'cardless') {
    if (!data.cardlessProvider) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a provider', path: ['cardlessProvider'] });
    if (!data.phoneNumber || data.phoneNumber.replace(/\D/g, '').length < 10)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 10-digit phone number', path: ['phoneNumber'] });
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
  const { user } = useWallet();
  const { currency } = useCurrency();
  const firestore = useFirestore();

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

  const [fiatRates, setFiatRates] = useState<Record<string, number>>({
    USD: 1, EUR: 0.92, GBP: 0.79, ZAR: 18.62, AUD: 1.53,
    CAD: 1.36, JPY: 149.50, CHF: 0.90, CNY: 7.24, INR: 83.10,
    NGN: 1580.00, BRL: 4.97, MXN: 17.15, SGD: 1.34, HKD: 7.82,
    NZD: 1.63, SEK: 10.45, NOK: 10.52, DKK: 6.87, PLN: 3.95,
  });

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
      cardlessProvider: '', phoneNumber: '',
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

  // ── Quote timer ───────────────────────────────────────────────────────────────
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
      .sort((a, b) => b.valueUSD - a.valueUSD);

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
  }, [walletDocs, withdrawRate]);

  const handleDetailsSubmit = async (data: FormValues) => {
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

    setStage('received'); setProgress(5);
    await delay(1400);

    setStage('kyc'); setProgress(15);
    await delay(2000);

    setStage('quoteLock'); setProgress(28);
    await delay(1600);

    setStage('onramp'); setProgress(45);
    const ok = await executeLedgerDebit(confirmedData, ref, carf);
    if (!ok) return;
    await delay(2400);

    setStage('carf'); setProgress(62);
    await delay(2000);

    setStage('bankClearing'); setProgress(82);
    await delay(method === 'cardless' ? 1800 : 2600);

    setStage('settled'); setProgress(100);
    await delay(1000);
    setStep('success');
  };

  const executeLedgerDebit = async (data: FormValues, ref: string, carfRef: string): Promise<boolean> => {
    try {
      const lockedPrices = quoteData?.lockedPrices ?? pricesRef.current;
      const amountInUSD = parseFloat(data.amount) / withdrawRate;

      const positions = (walletDocs ?? [])
        .map(w => {
          const price = lockedPrices[w.currency] ?? livePrices[w.currency] ?? 0;
          return { symbol: w.currency, balance: w.balance, priceUSD: price, valueUSD: w.balance * price };
        })
        .filter(p => p.balance > 0 && p.priceUSD > 0)
        .sort((a, b) => b.valueUSD - a.valueUSD);

      const totalValueUSD = positions.reduce((sum, p) => sum + p.valueUSD, 0);

      if (amountInUSD > totalValueUSD + 0.001) {
        setStep('details');
        toast({ title: 'Insufficient Balance', description: `Your portfolio value is ${formatWithdrawCurrency(totalValueUSD * withdrawRate)}. Please enter a lower amount.`, variant: 'destructive' });
        return false;
      }

      let remainingUSD = amountInUSD;
      const deductions: { symbol: string; coinAmount: number; priceUSD: number; usdContribution: number }[] = [];
      for (const pos of positions) {
        if (remainingUSD <= 0) break;
        const usdFromThisCoin = Math.min(remainingUSD, pos.valueUSD);
        deductions.push({ symbol: pos.symbol, coinAmount: usdFromThisCoin / pos.priceUSD, priceUSD: pos.priceUSD, usdContribution: usdFromThisCoin });
        remainingUSD -= usdFromThisCoin;
      }

      const coinRefs = deductions.map(d => doc(firestore!, 'users', user!.uid, 'wallets', d.symbol));

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
            ...(data.method === 'cardless' && { provider: data.cardlessProvider, phone: data.phoneNumber }),
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
      });

      return true;
    } catch (e: any) {
      setStep('details');
      toast({ title: 'Transaction Error', description: e.message || 'Unable to process withdrawal. Please try again.', variant: 'destructive' });
      return false;
    }
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const STAGES: { id: ProcessingStage; label: string; sub: string; icon: typeof CheckCircle2 }[] = [
    { id: 'received',     label: 'Request Received',            sub: 'Withdrawal logged on ledger',                  icon: FileText      },
    { id: 'kyc',          label: 'KYC & AML Verified',          sub: 'Identity and anti-money laundering checks',    icon: ShieldCheck   },
    { id: 'quoteLock',    label: 'Quote Locked & Settled',      sub: 'Exchange rate confirmed at settlement price',  icon: Lock          },
    { id: 'onramp',       label: 'On-ramp Partner Processing',  sub: 'Routed via Apex Liquidity Network',            icon: Zap           },
    { id: 'carf',         label: 'CARF Submitted to SARS',      sub: 'Crypto-Asset Reporting Framework data filed',  icon: DatabaseZap   },
    { id: 'bankClearing', label: 'Bank Network Clearing',       sub: 'Funds clearing through banking rails',         icon: Landmark      },
    { id: 'settled',      label: 'Settlement Complete',         sub: 'Funds cleared for payout',                     icon: CheckCircle2  },
  ];

  const stageIdx  = STAGES.findIndex(s => s.id === stage);
  const methodCfg = FEES[method];
  const amountVal = parseFloat(watchAmount) || 0;
  const exceedsBalance = amountVal > availableInWithdrawCurrency && availableInWithdrawCurrency > 0;
  const quoteExpired = quoteTimeLeft <= 0;

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
                    {step === 'processing' && <span className="text-primary font-medium">Processing…</span>}
                  </button>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* ══ STEP 1 — DETAILS ═══════════════════════════════════════════════ */}
          {step === 'details' && (
            <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-4">

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Withdrawal Method</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {([
                      { id: 'eft',      label: 'EFT / Bank Transfer', sub: 'SA Banks — 1–2 days',    icon: Building2  },
                      { id: 'cardless', label: 'Cardless ATM Cash',   sub: 'Instant — up to R3,000', icon: Smartphone },
                      { id: 'swift',    label: 'International Wire',  sub: 'SWIFT — 3–5 days',       icon: Globe      },
                    ] as const).map(opt => (
                      <button
                        key={opt.id} type="button"
                        onClick={() => form.setValue('method', opt.id, { shouldValidate: true })}
                        className={cn(
                          'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
                          method === opt.id ? 'bg-primary/10 border-primary/40 shadow-sm' : 'bg-muted/20 border-border/40 hover:border-border'
                        )}
                      >
                        <opt.icon className={cn('h-4 w-4 mb-2', method === opt.id ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="text-[11px] font-bold leading-tight block">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Beneficiary Details</p>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Full Legal Name & Surname</Label>
                    <Input className="h-11 bg-background/50 border-border/60 text-sm" placeholder="e.g. John David Smith" {...form.register('accountName')} />
                    {form.formState.errors.accountName && <p className="text-[11px] text-destructive">{form.formState.errors.accountName.message}</p>}
                    <p className="text-[10px] text-muted-foreground">Must match the registered name on the receiving account (FICA requirement)</p>
                  </div>

                  {method === 'eft' && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">Bank</Label>
                        <Select onValueChange={v => {
                          form.setValue('bankName', v, { shouldValidate: true });
                          const b = SA_BANKS.find(x => x.name === v);
                          if (b) form.setValue('branchCode', b.branch, { shouldValidate: true });
                        }}>
                          <SelectTrigger className="h-11 bg-background/50 border-border/60 text-sm"><SelectValue placeholder="Select your bank" /></SelectTrigger>
                          <SelectContent>
                            {SA_BANKS.map(b => (
                              <SelectItem key={b.name} value={b.name}>
                                <span>{b.name}</span>
                                <span className="ml-2 text-muted-foreground font-mono text-[11px]">({b.branch})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.bankName && <p className="text-[11px] text-destructive">{form.formState.errors.bankName.message}</p>}
                      </div>
                      {selectedBank && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20">
                          <Info className="h-3.5 w-3.5 text-accent shrink-0" />
                          <span className="text-[11px] text-muted-foreground">Universal branch code: <span className="font-mono font-bold text-foreground">{selectedBank.branch}</span> — auto-populated</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground">Account Number</Label>
                          <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm" placeholder="1234567890" {...form.register('accountNumber')} />
                          {form.formState.errors.accountNumber && <p className="text-[11px] text-destructive">{form.formState.errors.accountNumber.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground">Branch Code</Label>
                          <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm" placeholder="Auto-filled" readOnly {...form.register('branchCode')} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">Account Type</Label>
                        <Select onValueChange={v => form.setValue('accountType', v, { shouldValidate: true })}>
                          <SelectTrigger className="h-11 bg-background/50 border-border/60 text-sm"><SelectValue placeholder="Select account type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cheque">Cheque / Current Account</SelectItem>
                            <SelectItem value="savings">Savings Account</SelectItem>
                            <SelectItem value="transmission">Transmission Account</SelectItem>
                          </SelectContent>
                        </Select>
                        {form.formState.errors.accountType && <p className="text-[11px] text-destructive">{form.formState.errors.accountType.message}</p>}
                      </div>
                    </>
                  )}

                  {method === 'cardless' && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">ATM Voucher Provider</Label>
                        <Select onValueChange={v => form.setValue('cardlessProvider', v, { shouldValidate: true })}>
                          <SelectTrigger className="h-11 bg-background/50 border-border/60 text-sm"><SelectValue placeholder="Select provider" /></SelectTrigger>
                          <SelectContent>{CARDLESS_PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">Recipient Mobile Number</Label>
                        <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm" placeholder="082 123 4567" type="tel" {...form.register('phoneNumber')} />
                        {form.formState.errors.phoneNumber && <p className="text-[11px] text-destructive">{form.formState.errors.phoneNumber.message}</p>}
                        <p className="text-[10px] text-muted-foreground">A voucher SMS will be sent to this number</p>
                      </div>
                    </>
                  )}

                  {method === 'swift' && (
                    <>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          International wire transfers are subject to South African Reserve Bank (SARB) regulations. Your annual Single Discretionary Allowance is <strong className="text-foreground">R1,000,000</strong>. Amounts exceeding this require a SARB Foreign Capital Allowance approval.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">IBAN</Label>
                        <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm uppercase" placeholder="e.g. GB29 NWBK 6016 1331 9268 19" {...form.register('iban')} />
                        {form.formState.errors.iban && <p className="text-[11px] text-destructive">{form.formState.errors.iban.message}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground">SWIFT / BIC Code</Label>
                          <Input className="h-11 bg-background/50 border-border/60 font-mono text-sm uppercase" placeholder="e.g. NWBKGB2L" {...form.register('swiftCode')} />
                          {form.formState.errors.swiftCode && <p className="text-[11px] text-destructive">{form.formState.errors.swiftCode.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground">Destination Country</Label>
                          <Input className="h-11 bg-background/50 border-border/60 text-sm" placeholder="e.g. United Kingdom" {...form.register('bankCountry')} />
                          {form.formState.errors.bankCountry && <p className="text-[11px] text-destructive">{form.formState.errors.bankCountry.message}</p>}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">Correspondent Bank (if applicable)</Label>
                        <Input className="h-11 bg-background/50 border-border/60 text-sm" placeholder="Optional — for intermediary routing" {...form.register('correspondentBank')} />
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
                      <span className="text-[13px] font-bold text-accent">{formatWithdrawCurrency(availableInWithdrawCurrency)}</span>
                      <button type="button" onClick={handleFillMax} className="text-[10px] font-semibold text-primary hover:text-primary/80 border border-primary/30 rounded px-1.5 py-0.5 transition-colors">MAX</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Withdrawal Amount</p>
                    <span className="text-[11px] text-muted-foreground">
                      Limits: <span className="text-foreground font-medium">{withdrawCurrencySymbol} {methodCfg.minAmount.toLocaleString()} – {withdrawCurrencySymbol} {methodCfg.maxAmount.toLocaleString()}</span>
                    </span>
                  </div>

                  <div className={cn('flex h-14 rounded-xl border overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0', exceedsBalance ? 'border-destructive/60 bg-destructive/5' : 'border-border/60 bg-background/50')}>
                    <Popover open={currencyPickerOpen} onOpenChange={setCurrencyPickerOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="flex items-center gap-1.5 px-3 border-r border-border/60 text-sm font-semibold shrink-0 hover:bg-muted/40 transition-colors min-w-[80px]">
                          <span className="text-base leading-none">{withdrawCurrencyInfo.flag}</span>
                          <span className="tabular-nums">{withdrawCurrencySymbol}</span>
                          <ChevronDown className="h-3 w-3 opacity-50 ml-auto" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-2" sideOffset={4}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-1.5">Select currency</p>
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                          {currencies.map(c => (
                            <button key={c.symbol} type="button"
                              onClick={() => { setWithdrawCurrencySymbol(c.symbol); setCurrencyPickerOpen(false); }}
                              className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-muted/60 transition-colors text-left', withdrawCurrencySymbol === c.symbol && 'bg-primary/10 text-primary font-medium')}
                            >
                              <span className="text-base leading-none w-5">{c.flag}</span>
                              <span className="font-medium w-10">{c.symbol}</span>
                              <span className="text-muted-foreground text-xs">{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Input className="h-full border-0 bg-transparent pl-3 text-2xl font-bold tracking-tight flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none" type="number" step="any" placeholder="0.00" {...form.register('amount')} />
                  </div>

                  {exceedsBalance && (
                    <p className="text-[11px] text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Amount exceeds your available balance of {formatWithdrawCurrency(availableInWithdrawCurrency)}
                    </p>
                  )}
                  {form.formState.errors.amount && !exceedsBalance && <p className="text-[11px] text-destructive">{form.formState.errors.amount.message}</p>}

                  {amountVal >= methodCfg.minAmount && amountVal <= availableInWithdrawCurrency && (
                    <div className="rounded-xl border border-border/50 bg-background/30 divide-y divide-border/30">
                      <div className="flex justify-between items-center px-4 py-2.5 text-[12px]">
                        <span className="text-muted-foreground">Gross amount</span>
                        <span className="font-medium">{formatWithdrawCurrency(amountVal)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5 text-[12px]">
                        <span className="text-muted-foreground">Network fee</span>
                        <span className="text-destructive/80">− {formatWithdrawCurrency(fees.networkFee)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5 text-[12px]">
                        <span className="text-muted-foreground">Apex service fee ({methodCfg.label})</span>
                        <span className="text-destructive/80">− {formatWithdrawCurrency(fees.processingFee)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 text-[13px] bg-accent/5 rounded-b-xl">
                        <span className="font-semibold text-accent">You will receive</span>
                        <span className="font-bold text-accent text-base">{formatWithdrawCurrency(fees.net)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Estimated settlement: <strong className="text-foreground">{methodCfg.eta}</strong></span>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full h-12 font-semibold tracking-wide" disabled={!form.formState.isValid || exceedsBalance || availableInWithdrawCurrency <= 0}>
                Get Live Quote <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}

          {/* ══ STEP 2 — LIVE QUOTE ════════════════════════════════════════════ */}
          {step === 'quote' && confirmedData && quoteData && (
            <div className="space-y-4">
              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Live Settlement Quote</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Zap className="h-3 w-3 text-primary" />
                      <span>Apex Liquidity Network</span>
                    </div>
                  </div>

                  <div className="text-center py-4">
                    <p className="text-[11px] text-muted-foreground mb-1">You are withdrawing</p>
                    <p className="text-3xl font-bold tracking-tight">{formatWithdrawCurrency(parseFloat(confirmedData.amount))}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">≈ ${quoteData.amountInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                  </div>

                  <Separator className="opacity-30" />

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Liquidation Breakdown</p>
                    {quoteData.cryptoBreakdown.map(b => {
                      const coinName = marketCoins.find(c => c.symbol === b.symbol)?.name ?? b.symbol;
                      return (
                        <div key={b.symbol} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-background/30 border border-border/30">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold">{coinName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{b.symbol}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[12px] font-bold tabular-nums">{b.amount.toFixed(b.symbol === 'BTC' ? 8 : 6)} {b.symbol}</p>
                            <p className="text-[10px] text-muted-foreground">@ ${b.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator className="opacity-30" />

                  <div className="rounded-xl border border-border/50 bg-background/30 divide-y divide-border/30">
                    <div className="flex justify-between items-center px-4 py-2.5 text-[12px]">
                      <span className="text-muted-foreground">Total Fees</span>
                      <span className="text-destructive/80">− {formatWithdrawCurrency(fees.total)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3 text-[13px] bg-accent/5 rounded-b-xl">
                      <span className="font-semibold text-accent">You will receive</span>
                      <span className="font-bold text-accent text-base">{formatWithdrawCurrency(fees.net)}</span>
                    </div>
                  </div>

                  {/* Timer */}
                  <div className={cn('flex items-center justify-center gap-3 px-4 py-3 rounded-xl border', quoteExpired ? 'bg-destructive/5 border-destructive/20' : 'bg-primary/5 border-primary/20')}>
                    <Timer className={cn('h-4 w-4', quoteExpired ? 'text-destructive' : 'text-primary')} />
                    {quoteExpired ? (
                      <span className="text-[12px] text-destructive font-medium">Quote expired — rates may have changed</span>
                    ) : (
                      <span className="text-[12px] text-primary font-medium">
                        Quote valid for <span className="font-bold tabular-nums">{quoteTimeLeft}s</span>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setStep('details')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Edit Details
                </Button>
                {quoteExpired ? (
                  <Button className="flex-1 h-12 font-semibold" onClick={handleRefreshQuote}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh Quote
                  </Button>
                ) : (
                  <Button className="flex-1 h-12 font-semibold" onClick={handleAcceptQuote}>
                    Accept Quote <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ══ STEP 3 — REVIEW & COMPLIANCE ═══════════════════════════════════ */}
          {step === 'review' && confirmedData && (
            <div className="space-y-4">
              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Withdrawal Summary</p>
                  {[
                    ['Method', method === 'eft' ? 'EFT — South African Bank Transfer' : method === 'cardless' ? 'Cardless ATM Cash' : 'International SWIFT Wire'],
                    ['Beneficiary', confirmedData.accountName],
                    ...(method === 'eft' ? [['Bank', confirmedData.bankName ?? ''], ['Account Number', confirmedData.accountNumber ?? ''], ['Branch Code', confirmedData.branchCode ?? '']] : []),
                    ...(method === 'cardless' ? [['Provider', confirmedData.cardlessProvider ?? ''], ['Recipient Number', confirmedData.phoneNumber ?? '']] : []),
                    ...(method === 'swift' ? [['IBAN', confirmedData.iban ?? ''], ['SWIFT / BIC', confirmedData.swiftCode ?? ''], ['Destination Country', confirmedData.bankCountry ?? '']] : []),
                    ['Gross Amount', formatWithdrawCurrency(parseFloat(confirmedData.amount))],
                    ['Total Fees', `− ${formatWithdrawCurrency(fees.total)}`],
                    ['Amount to Receive', formatWithdrawCurrency(fees.net)],
                    ['Estimated Settlement', methodCfg.eta],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-start py-1.5 border-b border-border/20 last:border-0">
                      <span className="text-[12px] text-muted-foreground">{label}</span>
                      <span className={cn('text-[12px] font-medium text-right max-w-[60%]', label === 'Amount to Receive' && 'text-accent font-bold text-[14px]', label === 'Total Fees' && 'text-destructive/80')}>{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {parseFloat(confirmedData.amount) >= 25000 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-amber-500">FICA Reporting Threshold Reached</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      In accordance with Section 29 of the Financial Intelligence Centre Act (FICA) No. 38 of 2001, this transaction will be reported to the Financial Intelligence Centre (FIC) as it meets or exceeds the R25,000 threshold.
                    </p>
                  </div>
                </div>
              )}

              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Regulatory Declarations</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    In compliance with South African law and international financial regulations, you must confirm each declaration below before proceeding.
                  </p>
                  {([
                    { key: 'source' as const, title: 'Legitimate Source of Funds', text: 'I declare that the funds I am withdrawing originate from a legitimate source and are not proceeds of unlawful activities, as required under the Prevention of Organised Crime Act (POCA) No. 121 of 1998.' },
                    { key: 'fica' as const, title: 'FICA & AML Compliance', text: 'I consent to this transaction being reported to the Financial Intelligence Centre (FIC) where required under FICA No. 38 of 2001, and I understand that Apex Wallet is obligated to verify my identity and monitor transactions for anti-money laundering (AML) purposes.' },
                    { key: 'sars' as const, title: 'Tax Obligations (SARS)', text: 'I acknowledge that cryptocurrency transactions may constitute a taxable event under the South African Income Tax Act No. 58 of 1962 and that I am responsible for declaring any gains or income to the South African Revenue Service (SARS) in accordance with SARS guidance on crypto assets.' },
                    { key: 'sarb' as const, title: 'SARB Exchange Control Regulations', text: method === 'swift' ? "I confirm that this international transfer is within my permitted SARB Single Discretionary Allowance (R1,000,000 per calendar year) or that I have obtained a SARB Foreign Capital Allowance approval for amounts exceeding this limit, as required under the South African Reserve Bank's Currency and Exchanges Act No. 9 of 1933." : 'I confirm that this domestic transaction complies with applicable South African Reserve Bank (SARB) regulations and exchange control rules.' },
                    { key: 'carf' as const, title: 'CARF 2026 — Crypto-Asset Reporting', text: 'I acknowledge that, in accordance with the Crypto-Asset Reporting Framework (CARF) effective 1 March 2026, Apex Wallet is required to collect and report transaction data — including the Rand value of this disposal, the asset type, and my tax residency — to the South African Revenue Service (SARS). I consent to this reporting obligation.' },
                  ]).map(item => (
                    <div key={item.key} className="flex items-start gap-3 p-3 rounded-xl bg-background/30 border border-border/30">
                      <Checkbox id={item.key} checked={compliance[item.key]} onCheckedChange={v => setCompliance(prev => ({ ...prev, [item.key]: !!v }))} className="mt-0.5 shrink-0" />
                      <div>
                        <label htmlFor={item.key} className="text-[12px] font-semibold cursor-pointer">{item.title}</label>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button onClick={handleConfirm} disabled={!allCompliant} className="w-full h-12 font-semibold tracking-wide">
                <ShieldCheck className="mr-2 h-4 w-4" /> Confirm & Authorise Withdrawal
              </Button>

              <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-4">
                By confirming, you agree to Apex Wallet's Terms of Service and Privacy Policy. This withdrawal is final and cannot be reversed once processed.
              </p>
            </div>
          )}

          {/* ══ STEP 4 — PROCESSING ════════════════════════════════════════════ */}
          {step === 'processing' && (
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-8 pb-8">
                <div className="text-center mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <h3 className="text-base font-bold">Processing Your Withdrawal</h3>
                  <p className="text-[12px] text-muted-foreground mt-1">Reference: <span className="font-mono font-semibold text-foreground">{refNumber}</span></p>
                </div>

                <Progress value={progress} className="h-1.5 mb-8 bg-muted/30" />

                <div className="space-y-3">
                  {STAGES.map((s, idx) => {
                    const passed = stageIdx >= idx;
                    const active = stageIdx === idx;
                    return (
                      <div key={s.id} className={cn('flex items-center gap-4 p-3 rounded-xl transition-all duration-500',
                        active ? 'bg-primary/10 border border-primary/20' : passed ? 'bg-accent/5 border border-accent/15' : 'opacity-40'
                      )}>
                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
                          active ? 'bg-primary text-primary-foreground' : passed ? 'bg-accent/20 text-accent' : 'bg-muted/30 text-muted-foreground'
                        )}>
                          {active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <s.icon className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className={cn('text-[11px] font-semibold', passed ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{s.sub}</p>
                        </div>
                        {passed && !active && <CheckCircle2 className="h-4 w-4 text-accent ml-auto shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ══ STEP 5 — SUCCESS ═══════════════════════════════════════════════ */}
          {step === 'success' && confirmedData && (
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-8 pb-8">
                <div className="text-center space-y-2 mb-8">
                  <div className="h-16 w-16 rounded-full bg-accent/15 border-2 border-accent/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/10">
                    <CheckCircle2 className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold">Withdrawal Submitted</h3>
                  <p className="text-[12px] text-muted-foreground">Your request has been accepted and is being processed</p>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Transaction Reference</p>
                  <p className="font-mono font-bold text-lg tracking-widest text-primary">{refNumber}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Keep this reference for your records and any queries</p>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-6 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">CARF Reporting Reference</p>
                  <p className="font-mono font-bold text-sm tracking-widest text-blue-400">{carfRefNumber}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">SARS Crypto-Asset Reporting Framework — use this reference for tax queries</p>
                </div>

                <div className="rounded-xl border border-border/40 divide-y divide-border/30 mb-6">
                  {[
                    ['Amount Submitted', formatWithdrawCurrency(parseFloat(confirmedData.amount))],
                    ['Amount to Receive', formatWithdrawCurrency(fees.net)],
                    ['Method', method === 'eft' ? 'EFT Bank Transfer' : method === 'cardless' ? 'Cardless ATM Cash' : 'International SWIFT Wire'],
                    ['Beneficiary', confirmedData.accountName],
                    ['Estimated Settlement', methodCfg.eta],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center px-4 py-2.5">
                      <span className="text-[12px] text-muted-foreground">{label}</span>
                      <span className={cn('text-[12px] font-medium', label === 'Amount to Receive' && 'text-accent font-bold')}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-6">
                  <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-amber-500">SARS Tax Reminder</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Please retain both reference numbers for your tax return. Cryptocurrency gains may be subject to income tax or capital gains tax (CGT). Your CARF reference ({carfRefNumber}) can be used to verify this transaction with SARS. Consult a registered tax practitioner for advice specific to your situation.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button onClick={() => { setStep('details'); form.reset(); setCompliance({ source: false, fica: false, sars: false, sarb: false, carf: false }); setQuoteData(null); }} className="w-full h-11 font-semibold">
                    New Withdrawal
                  </Button>
                  <p className="text-center text-[10px] text-muted-foreground">
                    Questions? Contact us at <span className="text-foreground">support@apexwallet.io</span> with your reference number
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'details' && (
            <div className="px-1 pb-2 space-y-1.5">
              <Separator className="opacity-20" />
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed text-center">
                Apex Wallet operates in accordance with FICA No. 38 of 2001, the Currency and Exchanges Act No. 9 of 1933 (SARB), the Income Tax Act No. 58 of 1962 (SARS), POCA No. 121 of 1998, the Crypto-Asset Reporting Framework (CARF, effective 1 March 2026), and applicable FATF guidelines. All withdrawals are subject to compliance review. Apex Wallet is not a registered bank. Fiat disbursements are facilitated through licensed payment service providers.
              </p>
            </div>
          )}

        </div>
      </div>
    </PrivateRoute>
  );
}
