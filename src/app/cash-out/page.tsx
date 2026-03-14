
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ethers } from 'ethers';
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
  Wallet,
  Info,
  AlertCircle,
  ArrowDownToLine
} from 'lucide-react';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { getLivePrices } from '@/services/crypto-service';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDoc, useMemoFirebase } from '@/firebase';

// Schemas for Industrial Banking
const bankSchema = z.object({
  method: z.enum(['local_sa', 'international']),
  accountName: z.string().min(2, "Account holder name is required"),
  bankName: z.string().min(2, "Bank name is required"),
  accountNumber: z.string().optional(),
  branchCode: z.string().optional(),
  iban: z.string().optional(),
  swiftBic: z.string().optional(),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero",
  }),
}).refine((data) => {
  if (data.method === 'local_sa') {
    return !!data.accountNumber && data.accountNumber.length >= 8 && !!data.branchCode;
  }
  return !!data.iban && data.iban.length >= 15 && !!data.swiftBic;
}, {
  message: "Please fill in all required banking details for the selected protocol",
  path: ["accountNumber"],
});

type BankFormValues = z.infer<typeof bankSchema>;

const walletSchema = z.object({
  externalAddress: z.string().refine(ethers.isAddress, {
    message: "Please enter a valid Ethereum wallet address",
  }),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero",
  }),
});

type WalletFormValues = z.infer<typeof walletSchema>;

type WithdrawalStep = 'input' | 'verifying' | 'finalizing' | 'success';

export default function CashOutPage() {
  const { toast } = useToast();
  const { user } = useWallet();
  const { currency, formatCurrency } = useCurrency();
  const firestore = useFirestore();
  
  const [step, setStep] = useState<WithdrawalStep>('input');
  const [activeMethod, setActiveMethod] = useState<'bank' | 'wallet'>('bank');
  const [pendingData, setPendingData] = useState<any>(null);
  const [verificationProgress, setVerificationProgress] = useState(0);

  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);

  const { data: ethWallet } = useDoc<{ balance: number }>(ethWalletRef);
  const ethBalance = ethWallet?.balance ?? 0;

  const bankForm = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: { 
        method: 'local_sa', 
        accountName: '', 
        bankName: '', 
        accountNumber: '', 
        branchCode: '', 
        iban: '', 
        swiftBic: '', 
        amount: '' 
    },
    mode: 'onChange',
  });

  const walletForm = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: { externalAddress: '', amount: '' },
    mode: 'onChange',
  });

  const watchMethod = bankForm.watch('method');

  const startVerification = (data: any, method: 'bank' | 'wallet') => {
    setActiveMethod(method);
    setPendingData(data);
    setStep('verifying');
  };

  useEffect(() => {
    if (step === 'verifying') {
      const interval = setInterval(() => {
        setVerificationProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setStep('finalizing'), 500);
            return 100;
          }
          return prev + 4; // Authentic slow-crawl for security feel
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'finalizing') {
      handleFinalizeWithdrawal();
    }
  }, [step]);

  const handleFinalizeWithdrawal = async () => {
    if (!user || !firestore || !pendingData || !ethWalletRef) return;

    try {
      const prices = await getLivePrices(['ETH'], 'USD');
      const ethPriceUSD = prices.ETH || 3500;
      const amountInSelectedCurrency = parseFloat(pendingData.amount);
      const amountInUSD = amountInSelectedCurrency / currency.rate;
      const ethToDeduct = amountInUSD / ethPriceUSD;

      // Add a small 0.5% protocol fee for authenticity
      const fee = ethToDeduct * 0.005;
      const totalToDeduct = ethToDeduct + fee;

      if (totalToDeduct > ethBalance) {
        throw new Error(`Insufficient funds. You need ${totalToDeduct.toFixed(6)} ETH (incl. protocol fee) but have ${ethBalance.toFixed(6)} ETH.`);
      }

      await runTransaction(firestore, async (transaction) => {
        const walletDoc = await transaction.get(ethWalletRef);
        if (!walletDoc.exists()) throw new Error("Private Ledger Node: Wallet not found.");

        const currentBalance = walletDoc.data().balance;
        if (currentBalance < totalToDeduct) throw new Error("Private Ledger Node: Atomic sync failed - Insufficient funds.");

        transaction.update(ethWalletRef, {
          balance: currentBalance - totalToDeduct
        });

        const txRef = doc(collection(ethWalletRef, 'transactions'));
        
        let notes = "";
        if (activeMethod === 'bank') {
            if (pendingData.method === 'local_sa') {
                notes = `EFT South Africa to ${pendingData.bankName} (Acc: ${pendingData.accountNumber?.slice(-4)}...)`;
            } else {
                notes = `International SWIFT Wire to ${pendingData.bankName} (IBAN: ${pendingData.iban?.slice(0, 4)}...)`;
            }
        } else {
            notes = `Digital Asset Withdrawal to ${pendingData.externalAddress}`;
        }

        transaction.set(txRef, {
          userId: user.uid,
          type: 'Withdrawal',
          amount: ethToDeduct,
          fee: fee,
          price: ethPriceUSD,
          timestamp: serverTimestamp(),
          status: 'Completed',
          method: activeMethod,
          protocol: pendingData.method || 'Blockchain',
          notes: notes
        });
      });

      setStep('success');
      toast({ title: "Ledger Synchronized", description: "Gateway funds successfully dispatched." });
    } catch (error: any) {
      console.error("Withdrawal execution failed:", error);
      setStep('input');
      toast({
        title: "Protocol Error",
        description: error.message || "Ledger finalization failed.",
        variant: "destructive",
      });
    }
  };

  const renderSecurityTerminal = () => {
    const steps = [
      { id: 20, label: 'Initializing Apex Handshake' },
      { id: 40, label: 'Global AML & Compliance Scan' },
      { id: 60, label: watchMethod === 'local_sa' ? 'Clearing House Routing' : 'SWIFT Protocol Validation' },
      { id: 80, label: 'Verifying Liquidity Reservoir' },
      { id: 100, label: 'Finalizing Private Ledger entry' },
    ];
    const currentLabel = steps.find(s => verificationProgress <= s.id)?.label || 'Executing';

    return (
      <div className="flex flex-col items-center justify-center space-y-8 py-12 bg-black/20 rounded-2xl border border-white/5">
        <div className="relative">
          <div className="h-32 w-32 rounded-full border-4 border-primary/10 flex items-center justify-center shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)]">
            <Lock className="h-12 w-12 text-primary animate-pulse" />
          </div>
          <svg className="absolute top-0 left-0 h-32 w-32 -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="60"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={377}
              strokeDashoffset={377 - (377 * verificationProgress) / 100}
              className="text-primary transition-all duration-300"
            />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-black uppercase tracking-[0.3em] text-primary">Security Terminal</h3>
          <p className="text-[10px] font-mono text-muted-foreground uppercase animate-pulse">{currentLabel}...</p>
        </div>
        <div className="w-full max-w-[200px] bg-white/5 rounded-full h-1 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
            style={{ width: `${verificationProgress}%` }}
          />
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center text-center space-y-6 py-8">
      <div className="p-4 bg-accent/10 rounded-full border border-accent/20">
        <CheckCircle2 className="h-16 w-16 text-accent animate-in zoom-in" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-black tracking-tighter">Gateway Dispatched</h2>
        <p className="text-sm text-muted-foreground max-w-sm px-4">
            Transaction finalized on the Apex Private Ledger. Your funds are now in flight via the chosen banking protocol.
        </p>
      </div>
      <div className="w-full p-5 rounded-2xl bg-muted/30 border border-white/5 space-y-4">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-muted-foreground uppercase font-black tracking-widest">Protocol</span>
          <span className="font-mono text-primary uppercase font-bold">{pendingData?.method === 'local_sa' ? 'EFT / Clearing' : 'SWIFT / Wire'}</span>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-muted-foreground uppercase font-black tracking-widest">Status</span>
          <span className="text-accent font-black uppercase tracking-widest">Confirmed & Finalized</span>
        </div>
        <div className="h-px bg-white/5" />
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-muted-foreground uppercase font-black tracking-widest">Arrival</span>
          <span className="text-white font-bold">{pendingData?.method === 'local_sa' ? '24 Hours' : '3-5 Business Days'}</span>
        </div>
      </div>
      <Button onClick={() => { setStep('input'); setVerificationProgress(0); }} className="w-full btn-premium py-6 rounded-xl">
        Return to Gateway
      </Button>
    </div>
  );

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-6 pb-20">
        <Card className="w-full max-w-lg glass-module glass-glow-blue border-white/10 overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-black tracking-tight uppercase">Cash Out Gateway</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-primary/60 flex items-center gap-1">
                   <Lock className="h-3 w-3" /> Secure Banking Protocol v3.0
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            {step === 'input' && (
              <>
                <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-white/10 relative overflow-hidden group">
                  <div className="absolute -right-6 -top-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ArrowDownToLine className="h-28 w-28" />
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Available Liquidity</div>
                    <Badge variant="outline" className="text-[8px] bg-primary/10 border-primary/30 text-primary">LIVE SYNC</Badge>
                  </div>
                  <div className="text-4xl font-black tracking-tighter mb-1 text-white">{ethBalance.toFixed(6)} ETH</div>
                  <div className="text-sm font-bold text-accent">
                    ≈ {formatCurrency(ethBalance * (3500 * currency.rate))} 
                  </div>
                </div>

                <Tabs defaultValue="bank" className="w-full" onValueChange={(val) => setActiveMethod(val as any)}>
                  <TabsList className="grid w-full grid-cols-2 bg-black/20 p-1.5 rounded-2xl border border-white/5 mb-8">
                    <TabsTrigger value="bank" className="rounded-xl py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-bold">
                      <Building2 className="h-4 w-4 mr-2" /> Fiat Gateway
                    </TabsTrigger>
                    <TabsTrigger value="wallet" className="rounded-xl py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-bold">
                      <Globe className="h-4 w-4 mr-2" /> Digital Asset
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="bank" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-3">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Select Banking Protocol</Label>
                        <RadioGroup 
                            value={watchMethod}
                            className="grid grid-cols-2 gap-3"
                            onValueChange={(val) => bankForm.setValue('method', val as any, { shouldValidate: true })}
                        >
                            <div 
                                onClick={() => bankForm.setValue('method', 'local_sa', { shouldValidate: true })}
                                className={cn(
                                    "relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group",
                                    watchMethod === 'local_sa' ? "bg-primary/10 border-primary ring-1 ring-primary shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]" : "bg-muted/30 border-white/5 hover:border-white/10"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-1.5 rounded-lg transition-colors", watchMethod === 'local_sa' ? "bg-primary text-white" : "bg-white/5 text-muted-foreground")}>
                                        <Flag className="h-3 w-3" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="text-[11px] font-black uppercase tracking-tight">South Africa</div>
                                        <div className="text-[9px] text-muted-foreground font-bold">EFT / Instant</div>
                                    </div>
                                </div>
                                <RadioGroupItem value="local_sa" className="sr-only" />
                            </div>
                            <div 
                                onClick={() => bankForm.setValue('method', 'international', { shouldValidate: true })}
                                className={cn(
                                    "relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group",
                                    watchMethod === 'international' ? "bg-primary/10 border-primary ring-1 ring-primary shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]" : "bg-muted/30 border-white/5 hover:border-white/10"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-1.5 rounded-lg transition-colors", watchMethod === 'international' ? "bg-primary text-white" : "bg-white/5 text-muted-foreground")}>
                                        <Globe className="h-3 w-3" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="text-[11px] font-black uppercase tracking-tight">International</div>
                                        <div className="text-[9px] text-muted-foreground font-bold">SWIFT / Wire</div>
                                    </div>
                                </div>
                                <RadioGroupItem value="international" className="sr-only" />
                            </div>
                        </RadioGroup>
                    </div>

                    <form onSubmit={bankForm.handleSubmit((d) => startVerification(d, 'bank'))} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Account Holder</Label>
                          <Input className="bg-white/5 border-white/10 rounded-xl h-12 text-sm" placeholder="Legal Name" {...bankForm.register('accountName')} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Bank Name</Label>
                          <Input className="bg-white/5 border-white/10 rounded-xl h-12 text-sm" placeholder="e.g. FNB, Chase" {...bankForm.register('bankName')} />
                        </div>
                      </div>

                      {watchMethod === 'local_sa' ? (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Account Number</Label>
                                <Input className="bg-white/5 border-white/10 rounded-xl h-12 font-mono text-sm" placeholder="10-12 digits" {...bankForm.register('accountNumber')} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Branch Code</Label>
                                <Input className="bg-white/5 border-white/10 rounded-xl h-12 font-mono text-sm" placeholder="250655" {...bankForm.register('branchCode')} />
                            </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">IBAN Number</Label>
                                <Input className="bg-white/5 border-white/10 rounded-xl h-12 font-mono text-sm" placeholder="Intl. Format" {...bankForm.register('iban')} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">SWIFT / BIC</Label>
                                <Input className="bg-white/5 border-white/10 rounded-xl h-12 font-mono text-sm" placeholder="XXXX XX XX" {...bankForm.register('swiftBic')} />
                            </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Withdrawal Amount ({currency.symbol})</Label>
                        <div className="relative group">
                            <Input className="bg-white/5 border-white/10 rounded-xl h-14 text-2xl font-black transition-all group-focus-within:border-primary/50" type="number" step="any" placeholder="0.00" {...bankForm.register('amount')} />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <div className="h-4 w-px bg-white/10" />
                                <span className="text-xs font-black text-primary">{currency.symbol}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center px-1">
                             <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Info className="h-3 w-3" />
                                Protocol Fee: <span className="text-white font-bold">0.5%</span>
                             </div>
                             {bankForm.watch('amount') && (
                                <div className="text-[10px] text-accent font-bold">
                                    ≈ {(parseFloat(bankForm.watch('amount')) / (3500 * currency.rate)).toFixed(6)} ETH
                                </div>
                             )}
                        </div>
                      </div>
                      
                      <Button type="submit" className="w-full btn-premium py-7 mt-4 rounded-xl text-sm font-black uppercase tracking-widest">
                        <ShieldCheck className="mr-3 h-5 w-5" /> Execute Protocol Transfer
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="wallet" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4 flex gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                        <p className="text-[10px] text-amber-200/80 leading-relaxed font-bold uppercase tracking-tight">
                            Ensure the destination address supports the Ethereum Network. Assets sent to incorrect chains may be permanently lost on the private ledger.
                        </p>
                    </div>
                    <form onSubmit={walletForm.handleSubmit((d) => startVerification(d, 'wallet'))} className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Destination EVM Address</Label>
                        <Input className="bg-white/5 border-white/10 rounded-xl h-12 font-mono text-sm" placeholder="0x..." {...walletForm.register('externalAddress')} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Asset Amount ({currency.symbol})</Label>
                         <div className="relative group">
                            <Input className="bg-white/5 border-white/10 rounded-xl h-14 text-2xl font-black transition-all group-focus-within:border-primary/50" type="number" step="any" placeholder="0.00" {...walletForm.register('amount')} />
                             <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <div className="h-4 w-px bg-white/10" />
                                <span className="text-xs font-black text-primary">{currency.symbol}</span>
                            </div>
                        </div>
                      </div>
                      <Button type="submit" className="w-full btn-premium py-7 mt-4 rounded-xl text-sm font-black uppercase tracking-widest">
                        <Globe className="mr-3 h-5 w-5" /> Dispatch Digital Asset
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}

            {(step === 'verifying' || step === 'finalizing') && renderSecurityTerminal()}
            {step === 'success' && renderSuccess()}
          </CardContent>
          <CardFooter className="bg-black/20 border-t border-white/5 py-4 flex items-center justify-center gap-3">
            <div className="flex -space-x-1">
                <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                <div className="h-3 w-3 rounded-full bg-cyan-500 animate-pulse delay-75" />
            </div>
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Apex Multi-Region Gateway • Encrypted Handshake
            </span>
          </CardFooter>
        </Card>
      </div>
    </PrivateRoute>
  );
}
    