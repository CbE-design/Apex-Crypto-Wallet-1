
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Globe, 
  Building2, 
  Lock,
  Flag,
  Info,
  AlertCircle,
  ArrowDownToLine,
  Loader2,
  Activity,
  CreditCard,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { getLivePrices } from '@/services/crypto-service';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Industrial Schemas
const bankSchema = z.object({
  protocol: z.enum(['local_sa', 'international']),
  provider: z.string().min(1, "Please select a provider or bank"),
  accountName: z.string().min(2, "Account holder name is required"),
  accountNumber: z.string().optional(),
  branchCode: z.string().optional(),
  iban: z.string().optional(),
  swiftBic: z.string().optional(),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero",
  }),
}).refine((data) => {
  if (data.protocol === 'local_sa') {
    return !!data.accountNumber && data.accountNumber.length >= 8 && !!data.branchCode;
  }
  return !!data.iban && data.iban.length >= 15 && !!data.swiftBic;
}, {
  message: "Please fill in all required banking details",
  path: ["accountNumber"],
});

type BankFormValues = z.infer<typeof bankSchema>;

const SA_BANKS = ["FNB", "Standard Bank", "Capitec", "Absa", "Nedbank", "Investec"];
const INTL_PROVIDERS = ["Stripe Connect", "PayPal Payouts", "Wise Business"];

type WithdrawalStep = 'input' | 'security' | 'tracking' | 'success';
type TrackingStatus = 'initiated' | 'confirmed' | 'processing' | 'completed';

export default function CashOutPage() {
  const { toast } = useToast();
  const { user } = useWallet();
  const { currency, formatCurrency } = useCurrency();
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

  // Fee Calculation Logic
  const fees = useMemo(() => {
    const val = parseFloat(watchAmount) || 0;
    const gasFee = 15.00 * currency.rate; // $15 simulated gas
    const processingRate = watchProtocol === 'local_sa' ? 0.015 : 0.03;
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
    if (pin.length < 4) {
      toast({ title: "Security Error", description: "Invalid PIN format.", variant: "destructive" });
      return;
    }
    setIsSecurityOpen(false);
    setStep('tracking');
    runTrackingSimulation();
  };

  const runTrackingSimulation = async () => {
    // 1. Initiated
    setTrackingStatus('initiated');
    setTrackingProgress(10);
    await new Promise(r => setTimeout(r, 2000));

    // 2. Blockchain Confirmed (Write to Ledger)
    setTrackingProgress(40);
    setTrackingStatus('confirmed');
    const success = await executeLedgerDebit();
    if (!success) return;
    await new Promise(r => setTimeout(r, 3000));

    // 3. Bank Processing
    setTrackingProgress(75);
    setTrackingStatus('processing');
    await new Promise(r => setTimeout(r, 3000));

    // 4. Completed
    setTrackingProgress(100);
    setTrackingStatus('completed');
    setTimeout(() => setStep('success'), 1000);
  };

  const executeLedgerDebit = async () => {
    if (!user || !firestore || !pendingData || !ethWalletRef) return false;

    try {
      const prices = await getLivePrices(['ETH'], 'USD');
      const ethPriceUSD = prices.ETH || 3500;
      const amountInUSD = parseFloat(pendingData.amount) / currency.rate;
      const ethToDeduct = amountInUSD / ethPriceUSD;

      if (ethToDeduct > ethBalance) {
        throw new Error("Insufficient Ledger Balance.");
      }

      await runTransaction(firestore, async (transaction) => {
        const walletDoc = await transaction.get(ethWalletRef);
        if (!walletDoc.exists()) throw new Error("Wallet not found.");
        
        const currentBalance = walletDoc.data().balance;
        transaction.update(ethWalletRef, { balance: currentBalance - ethToDeduct });

        const txRef = doc(collection(ethWalletRef, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          type: 'Withdrawal',
          amount: ethToDeduct,
          price: ethPriceUSD,
          timestamp: serverTimestamp(),
          status: 'Completed',
          notes: `Payout to ${pendingData.provider} (${pendingData.protocol})`
        });
      });
      return true;
    } catch (e: any) {
      setStep('input');
      toast({ title: "Ledger Error", description: e.message, variant: "destructive" });
      return false;
    }
  };

  const renderStatusTracker = () => {
    const statuses = [
      { id: 'initiated', label: 'Initiated', icon: Activity },
      { id: 'confirmed', label: 'Blockchain Confirmed', icon: ShieldCheck },
      { id: 'processing', label: 'Bank Processing', icon: Building2 },
      { id: 'completed', label: 'Completed', icon: CheckCircle2 },
    ];

    return (
      <div className="space-y-8 py-8 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
            <h3 className="text-2xl font-black tracking-tighter uppercase italic text-primary">Gateway in Transit</h3>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">Cross-Protocol Handshake v4.2</p>
        </div>

        <div className="relative pt-8">
            <Progress value={trackingProgress} className="h-2 bg-white/5" />
            <div className="flex justify-between mt-6">
                {statuses.map((s, idx) => {
                    const isActive = trackingStatus === s.id;
                    const isPassed = statuses.findIndex(x => x.id === trackingStatus) >= idx;
                    return (
                        <div key={s.id} className="flex flex-col items-center gap-3 group">
                            <div className={cn(
                                "h-10 w-10 rounded-xl border flex items-center justify-center transition-all duration-500",
                                isActive ? "bg-primary text-white scale-110 shadow-[0_0_20px_rgba(59,130,246,0.5)] border-primary" : 
                                isPassed ? "bg-accent/20 text-accent border-accent/40" : "bg-muted/30 text-muted-foreground border-white/5"
                            )}>
                                <s.icon className="h-5 w-5" />
                            </div>
                            <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest text-center max-w-[60px]",
                                isPassed ? "text-white" : "text-muted-foreground"
                            )}>
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>

        <Card className="bg-black/20 border-white/5 p-6 rounded-2xl">
            <div className="flex items-center gap-4">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-white uppercase tracking-tight">Current Operation</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                        {trackingStatus === 'initiated' && 'Synchronizing transaction packet with node cluster...'}
                        {trackingStatus === 'confirmed' && 'Atomic state update written to Apex Private Ledger...'}
                        {trackingStatus === 'processing' && 'Routing funds via regional clearing house nodes...'}
                        {trackingStatus === 'completed' && 'Gateway successfully finalized. Funds dispatched.'}
                    </p>
                </div>
            </div>
        </Card>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 animate-in zoom-in-95 duration-500">
      <div className="h-24 w-24 rounded-full bg-accent/20 border-4 border-accent flex items-center justify-center shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]">
        <CheckCircle2 className="h-12 w-12 text-accent" />
      </div>
      <div className="space-y-2">
        <h2 className="text-4xl font-black tracking-tighter uppercase italic">Success</h2>
        <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Gateway Dispatched</p>
      </div>
      <div className="w-full bg-white/5 p-5 rounded-2xl border border-white/10 space-y-3 font-mono">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">REF:</span>
          <span className="text-white">APX-{Math.random().toString(36).substring(7).toUpperCase()}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">AMOUNT:</span>
          <span className="text-accent">{formatCurrency(parseFloat(pendingData?.amount || '0'))}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">EST. ARRIVAL:</span>
          <span className="text-primary">{watchProtocol === 'local_sa' ? 'INSTANT - 24H' : '1-3 BUSINESS DAYS'}</span>
        </div>
      </div>
      <Button onClick={() => setStep('input')} className="w-full btn-premium py-7 rounded-2xl font-black uppercase tracking-widest">
        Return to Portal
      </Button>
    </div>
  );

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-6 pb-20">
        <Card className="w-full max-w-lg glass-module glass-glow-blue border-white/10 overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-white/5 bg-white/5 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/20 rounded-2xl border border-primary/40">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight uppercase italic">Cash Out</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-400">Multi-Region Gateway v4.2</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="bg-primary/10 border-primary/40 text-[10px] font-black italic">
                SECURE HANDSHAKE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-10">
            {step === 'input' && (
              <form onSubmit={form.handleSubmit(handleInitiate)} className="space-y-8">
                
                {/* Protocol Selector */}
                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Banking Protocol</Label>
                  <RadioGroup 
                    value={watchProtocol} 
                    onValueChange={(val) => form.setValue('protocol', val as any)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div 
                      onClick={() => form.setValue('protocol', 'local_sa')}
                      className={cn(
                        "relative p-6 rounded-3xl border transition-all cursor-pointer group overflow-hidden",
                        watchProtocol === 'local_sa' ? "bg-primary/10 border-primary ring-1 ring-primary shadow-2xl" : "bg-muted/20 border-white/5 hover:border-white/20"
                      )}
                    >
                      <Flag className={cn("h-4 w-4 mb-3 transition-colors", watchProtocol === 'local_sa' ? "text-primary" : "text-muted-foreground")} />
                      <div className="text-sm font-black uppercase tracking-tight">South Africa</div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">EFT Clearing</div>
                    </div>
                    <div 
                      onClick={() => form.setValue('protocol', 'international')}
                      className={cn(
                        "relative p-6 rounded-3xl border transition-all cursor-pointer group overflow-hidden",
                        watchProtocol === 'international' ? "bg-primary/10 border-primary ring-1 ring-primary shadow-2xl" : "bg-muted/20 border-white/5 hover:border-white/20"
                      )}
                    >
                      <Globe className={cn("h-4 w-4 mb-3 transition-colors", watchProtocol === 'international' ? "text-primary" : "text-muted-foreground")} />
                      <div className="text-sm font-black uppercase tracking-tight">International</div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">SWIFT Protocol</div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Account Details */}
                <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payout Provider / Bank</Label>
                      <Select onValueChange={(val) => form.setValue('provider', val)}>
                        <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl">
                          <SelectValue placeholder="Choose entity" />
                        </SelectTrigger>
                        <SelectContent>
                          {(watchProtocol === 'local_sa' ? SA_BANKS : INTL_PROVIDERS).map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Holder Name</Label>
                      <Input className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm" placeholder="Legal full name" {...form.register('accountName')} />
                    </div>

                    {watchProtocol === 'local_sa' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account No.</Label>
                          <Input className="h-14 bg-white/5 border-white/10 rounded-2xl font-mono text-sm" placeholder="XXXXXXXXX" {...form.register('accountNumber')} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Branch Code</Label>
                          <Input className="h-14 bg-white/5 border-white/10 rounded-2xl font-mono text-sm" placeholder="250655" {...form.register('branchCode')} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">IBAN Number</Label>
                          <Input className="h-14 bg-white/5 border-white/10 rounded-2xl font-mono text-sm" placeholder="International Format" {...form.register('iban')} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">SWIFT / BIC Code</Label>
                          <Input className="h-14 bg-white/5 border-white/10 rounded-2xl font-mono text-sm" placeholder="XXXX XX XX" {...form.register('swiftBic')} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fee Calculator Module */}
                <div className="space-y-4">
                   <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Withdrawal Amount ({currency.symbol})</Label>
                   <div className="relative group">
                      <Input 
                        className="h-20 bg-primary/5 border-primary/20 rounded-3xl text-3xl font-black text-white transition-all focus:border-primary focus:ring-1 focus:ring-primary pl-16" 
                        type="number" 
                        step="any" 
                        placeholder="0.00" 
                        {...form.register('amount')} 
                      />
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-xl italic">{currency.symbol}</div>
                   </div>

                   {parseFloat(watchAmount) > 0 && (
                      <div className="p-6 rounded-3xl bg-muted/30 border border-white/5 space-y-3 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-muted-foreground">Network Gas Fee</span>
                          <span className="text-white">{formatCurrency(fees.gasFee)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-muted-foreground">Gateway Proc. Fee</span>
                          <span className="text-white">{formatCurrency(fees.processingFee)}</span>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Final Settlement</span>
                          <span className="text-xl font-black italic text-accent">{formatCurrency(fees.netAmount)}</span>
                        </div>
                      </div>
                   )}
                </div>

                <Button type="submit" className="w-full btn-premium py-8 rounded-3xl font-black uppercase tracking-[0.2em] text-sm italic group" disabled={!form.formState.isValid}>
                  Initialize Dispatch <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>
            )}

            {step === 'tracking' && renderStatusTracker()}
            {step === 'success' && renderSuccess()}
          </CardContent>
          
          <CardFooter className="bg-black/40 border-t border-white/5 py-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-accent" />
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">End-to-End Encrypted Transit Pipeline</span>
            </div>
            <p className="text-[8px] text-muted-foreground/50 font-mono">NODE_IDENTITY: {user?.uid.substring(0, 16).toUpperCase()}</p>
          </CardFooter>
        </Card>
      </div>

      {/* Security Verification Dialog */}
      <Dialog open={isSecurityOpen} onOpenChange={setIsSecurityOpen}>
        <DialogContent className="sm:max-w-md bg-card border-white/10 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black italic uppercase italic">
              <ShieldAlert className="h-6 w-6 text-primary" />
              Security Challenge
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground pt-2">
              Please enter your 6-digit Secret PIN to authorize this ledger dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8">
            <Input 
              type="password" 
              className="h-16 bg-white/5 border-white/10 rounded-2xl text-center text-3xl font-black tracking-[0.5em]" 
              placeholder="••••••"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={handleSecurityConfirm} className="w-full py-7 rounded-2xl font-black uppercase tracking-widest text-xs italic">
              Authorize Finalization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PrivateRoute>
  );
}

