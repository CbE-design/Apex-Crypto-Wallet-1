
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Globe, 
  Building2, 
  Flag,
  Loader2,
  Activity,
  CreditCard,
  ChevronRight,
  ShieldAlert,
  Wallet,
  Banknote,
  RefreshCw
} from 'lucide-react';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { getLivePrices } from '@/services/crypto-service';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { currencies } from '@/lib/currencies';

// Updated Schema: Removed cardless, kept local and international
const bankSchema = z.object({
  protocol: z.enum(['local_sa', 'international']),
  provider: z.string().min(1, "Please select a provider or bank"),
  accountName: z.string().min(2, "Full legal name is required"),
  accountNumber: z.string().optional(),
  branchCode: z.string().optional(),
  iban: z.string().optional(),
  swiftBic: z.string().optional(),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero",
  }),
}).refine((data) => {
  if (data.protocol === 'local_sa') {
    return !!data.accountNumber && !!data.branchCode;
  }
  return !!data.iban && !!data.swiftBic;
}, {
  message: "Please fill in all required bank details",
  path: ["accountNumber"],
});

type BankFormValues = z.infer<typeof bankSchema>;

const SA_BANKS = ["FNB", "Standard Bank", "Capitec", "Absa", "Nedbank", "Investec", "TymeBank", "Discovery Bank"];
const INTL_PROVIDERS = ["Stablecoin Swap (USDC)", "Global Payout Rail", "Wise Business", "Direct SWIFT Wire"];

type WithdrawalStep = 'input' | 'security' | 'tracking' | 'success';
type TrackingStatus = 'initiated' | 'confirmed' | 'processing' | 'completed';

export default function CashOutPage() {
  const { toast } = useToast();
  const { user } = useWallet();
  const { currency, setCurrency, formatCurrency } = useCurrency();
  const firestore = useFirestore();
  
  const [step, setStep] = useState<WithdrawalStep>('input');
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('initiated');
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingData, setPendingData] = useState<BankFormValues | null>(null);

  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);

  const { data: ethWallet } = useDoc<{ balance: number }>(ethWalletRef);
  const ethBalance = ethWallet?.balance ?? 0;

  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: { 
        protocol: 'local_sa', 
        provider: '',
        accountName: '', 
        accountNumber: '', 
        branchCode: '', 
        iban: '', 
        swiftBic: '', 
        amount: '' 
    },
    mode: 'onChange',
  });

  const watchAmount = form.watch('amount');
  const watchProtocol = form.watch('protocol');

  const fees = useMemo(() => {
    const val = parseFloat(watchAmount) || 0;
    const gasFee = 12.50 * currency.rate; 
    const processingRate = watchProtocol === 'local_sa' ? 0.012 : 0.032;
    const processingFee = val * processingRate;
    const totalFees = gasFee + processingFee;
    const netAmount = Math.max(0, val - totalFees);

    return { gasFee, processingFee, totalFees, netAmount };
  }, [watchAmount, watchProtocol, currency.rate]);

  const handleInitiate = (data: BankFormValues) => {
    setPendingData(data);
    setIsSecurityOpen(true);
  };

  const handleSecurityConfirm = async () => {
    if (pin.length < 6) {
      toast({ title: "Security Challenge Failed", description: "Identity PIN must be 6 digits.", variant: "destructive" });
      return;
    }
    // Simulation check: For this prototype, any 6 digit pin passes, 
    // but the logic is structured for real integration.
    setIsSecurityOpen(false);
    setStep('tracking');
    runTrackingSimulation();
  };

  const runTrackingSimulation = async () => {
    setTrackingStatus('initiated');
    setTrackingProgress(10);
    await new Promise(r => setTimeout(r, 1500));

    setTrackingProgress(40);
    setTrackingStatus('confirmed');
    const success = await executeLedgerDebit();
    if (!success) return;
    await new Promise(r => setTimeout(r, 2500));

    setTrackingProgress(75);
    setTrackingStatus('processing');
    await new Promise(r => setTimeout(r, 3000));

    setTrackingProgress(100);
    setTrackingStatus('completed');
    setTimeout(() => setStep('success'), 1000);
  };

  const executeLedgerDebit = async () => {
    if (!user || !firestore || !pendingData || !ethWalletRef) return false;

    try {
      const prices = await getLivePrices(['ETH'], 'USD');
      const ethPriceUSD = prices.ETH || 3500;
      const amountInUSD = parseFloat(pendingData.amount) / (currency.rate || 1);
      const ethToDeduct = amountInUSD / ethPriceUSD;

      if (ethToDeduct > ethBalance) {
        throw new Error("Insufficient Ledger Balance for this operation.");
      }

      await runTransaction(firestore, async (transaction) => {
        const walletDoc = await transaction.get(ethWalletRef);
        if (!walletDoc.exists()) throw new Error("Wallet identity not found.");
        
        const currentBalance = walletDoc.data().balance;
        transaction.update(ethWalletRef, { 
            balance: currentBalance - ethToDeduct,
            lastSynced: serverTimestamp() 
        });

        const txRef = doc(collection(ethWalletRef, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          type: 'Withdrawal',
          amount: ethToDeduct,
          price: ethPriceUSD,
          timestamp: serverTimestamp(),
          status: 'Completed',
          notes: `Cash Out: ${pendingData.provider} (${pendingData.protocol.toUpperCase()})`
        });
      });
      return true;
    } catch (e: any) {
      setStep('input');
      toast({ title: "Ledger Settlement Failed", description: e.message, variant: "destructive" });
      return false;
    }
  };

  const renderStatusTracker = () => {
    const statuses = [
      { id: 'initiated', label: 'Compliance', icon: Activity },
      { id: 'confirmed', label: 'Ledger Node', icon: ShieldCheck },
      { id: 'processing', label: 'Settlement', icon: Building2 },
      { id: 'completed', label: 'Liquidity', icon: CheckCircle2 },
    ];

    return (
      <div className="space-y-8 py-8 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-primary">Dispatching Liquidity</h3>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">RAIL: {watchProtocol.toUpperCase()}</p>
        </div>

        <div className="relative pt-8">
            <Progress value={trackingProgress} className="h-1.5 bg-muted" />
            <div className="flex justify-between mt-6 px-2">
                {statuses.map((s, idx) => {
                    const isActive = trackingStatus === s.id;
                    const isPassed = statuses.findIndex(x => x.id === trackingStatus) >= idx;
                    return (
                        <div key={s.id} className="flex flex-col items-center gap-3">
                            <div className={cn(
                                "h-9 w-9 rounded-full border flex items-center justify-center transition-all duration-500",
                                isActive ? "bg-primary text-white scale-110 shadow-lg border-primary" : 
                                isPassed ? "bg-accent/20 text-accent border-accent/40" : "bg-muted/30 text-muted-foreground border-white/5"
                            )}>
                                <s.icon className="h-4 w-4" />
                            </div>
                            <span className={cn(
                                "text-[9px] font-bold uppercase tracking-tight text-center",
                                isPassed ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    );
  };

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-6 pb-20">
        <Card className="w-full max-w-lg glass-module border-white/10 overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-white/5 bg-white/5 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold tracking-tight">Cash Out Hub</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">Secure Asset Liquidation</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="h-6 text-[10px] font-bold">
                SECURE RAIL
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            {step === 'input' && (
              <form onSubmit={form.handleSubmit(handleInitiate)} className="space-y-8">
                
                <div className="space-y-4">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Payout Destination</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => form.setValue('protocol', 'local_sa', { shouldValidate: true })}
                      className={cn(
                        "relative p-4 rounded-xl border transition-all cursor-pointer text-left",
                        watchProtocol === 'local_sa' ? "bg-primary/5 border-primary shadow-sm" : "bg-muted/20 border-white/5 hover:border-white/20"
                      )}
                    >
                      <Flag className={cn("h-4 w-4 mb-2", watchProtocol === 'local_sa' ? "text-primary" : "text-muted-foreground")} />
                      <div className="text-[11px] font-bold uppercase tracking-tight">Local Bank (EFT)</div>
                    </button>
                    <button 
                      type="button"
                      onClick={() => form.setValue('protocol', 'international', { shouldValidate: true })}
                      className={cn(
                        "relative p-4 rounded-xl border transition-all cursor-pointer text-left",
                        watchProtocol === 'international' ? "bg-primary/5 border-primary shadow-sm" : "bg-muted/20 border-white/5 hover:border-white/20"
                      )}
                    >
                      <Globe className={cn("h-4 w-4 mb-2", watchProtocol === 'international' ? "text-primary" : "text-muted-foreground")} />
                      <div className="text-[11px] font-bold uppercase tracking-tight">International (SWIFT)</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                        {watchProtocol === 'local_sa' ? 'Receiving Bank' : 'Payout Provider'}
                      </Label>
                      <Select onValueChange={(val) => form.setValue('provider', val, { shouldValidate: true })}>
                        <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl">
                          <SelectValue placeholder="Select Destination Bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {(watchProtocol === 'local_sa' ? SA_BANKS : INTL_PROVIDERS).map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Beneficiary Name</Label>
                      <Input className="h-12 bg-white/5 border-white/10 rounded-xl text-sm" placeholder="e.g., John Smith" {...form.register('accountName')} />
                    </div>

                    {watchProtocol === 'local_sa' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Account Number</Label>
                          <Input className="h-12 bg-white/5 border-white/10 rounded-xl font-mono text-sm" placeholder="1234567890" {...form.register('accountNumber')} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Branch Code</Label>
                          <Input className="h-12 bg-white/5 border-white/10 rounded-xl font-mono text-sm" placeholder="250655" {...form.register('branchCode')} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">IBAN Number</Label>
                          <Input className="h-12 bg-white/5 border-white/10 rounded-xl font-mono text-sm" placeholder="GBXX XXXX XXXX XXXX" {...form.register('iban')} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">SWIFT / BIC Code</Label>
                          <Input className="h-12 bg-white/5 border-white/10 rounded-xl font-mono text-sm" placeholder="XXXX GB 2L" {...form.register('swiftBic')} />
                        </div>
                      </div>
                    )}
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between px-1">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Settlement Amount</Label>
                        <Select value={currency.symbol} onValueChange={setCurrency}>
                            <SelectTrigger className="h-7 w-24 bg-primary/10 border-none rounded-lg text-[10px] font-bold">
                                <SelectValue placeholder="CCY" />
                            </SelectTrigger>
                            <SelectContent>
                                {currencies.map(c => (
                                    <SelectItem key={c.symbol} value={c.symbol} className="text-[10px] font-bold">{c.symbol}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                   </div>
                   <div className="relative">
                      <Input 
                        className="h-16 bg-primary/5 border-primary/20 rounded-2xl text-2xl font-bold text-white pl-12" 
                        type="number" 
                        step="any" 
                        placeholder="0.00" 
                        {...form.register('amount')} 
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-lg">{currency.symbol}</div>
                   </div>

                   {parseFloat(watchAmount) > 0 && (
                      <div className="p-5 rounded-2xl bg-muted/20 border border-white/5 space-y-3 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-widest">
                          <span className="text-muted-foreground">Ledger Sync Fee</span>
                          <span className="text-white">{formatCurrency(fees.gasFee)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-widest">
                          <span className="text-muted-foreground">Orchestration Fee</span>
                          <span className="text-white">{formatCurrency(fees.processingFee)}</span>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Estimated Net Payout</span>
                          <span className="text-lg font-bold text-accent">{formatCurrency(fees.netAmount)}</span>
                        </div>
                      </div>
                   )}
                </div>

                <Button type="submit" className="w-full h-14 rounded-2xl font-bold uppercase tracking-widest text-xs group" disabled={!form.formState.isValid}>
                  Authorize Payout <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>
            )}

            {step === 'tracking' && renderStatusTracker()}
            
            {step === 'success' && (
                <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 animate-in zoom-in-95 duration-500">
                  <div className="h-20 w-20 rounded-full bg-accent/10 border-2 border-accent flex items-center justify-center shadow-xl">
                    <CheckCircle2 className="h-10 w-10 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Funds Dispatched</h2>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-widest">Liquidity Cleared via Partner Gateway</p>
                  </div>
                  <div className="w-full p-4 bg-muted/20 rounded-xl border border-white/5 text-left space-y-2">
                        <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                            <span>Reference</span>
                            <span className="text-foreground">APX-{Math.random().toString(36).substring(7).toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                            <span>Status</span>
                            <span className="text-accent flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> VERIFIED</span>
                        </div>
                  </div>
                  <Button onClick={() => setStep('input')} variant="outline" className="w-full h-12 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                    Return to Liquidity Hub
                  </Button>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isSecurityOpen} onOpenChange={setIsSecurityOpen}>
        <DialogContent className="sm:max-w-md bg-card border-white/10 rounded-2xl">
          <div className="flex flex-col items-center text-center space-y-4 pt-4">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <ShieldAlert className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">Security Challenge</h3>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Confirm your identity to authorize liquidity dispatch.
              </p>
            </div>
          </div>
          <div className="py-6">
            <Input 
              type="password" 
              className="h-14 bg-white/5 border-white/10 rounded-xl text-center text-2xl font-bold tracking-[0.5em] focus:border-primary" 
              placeholder="••••••"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          <Button onClick={handleSecurityConfirm} className="w-full h-12 rounded-xl font-bold uppercase tracking-widest text-[10px]">
            Finalize Verification
          </Button>
        </DialogContent>
      </Dialog>
    </PrivateRoute>
  );
}
