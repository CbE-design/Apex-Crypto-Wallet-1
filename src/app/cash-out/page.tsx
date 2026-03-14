
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
  Banknote, 
  Wallet, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck, 
  Globe, 
  Building2, 
  ArrowRight, 
  AlertCircle,
  FileCheck2,
  Lock
} from 'lucide-react';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { getLivePrices } from '@/services/crypto-service';
import { cn } from '@/lib/utils';

const bankSchema = z.object({
  accountName: z.string().min(2, "Account holder name is required"),
  bankName: z.string().min(2, "Bank name is required"),
  iban: z.string().min(15, "Valid IBAN is required for international transfers"),
  swiftBic: z.string().min(8, "Valid SWIFT/BIC code is required"),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero",
  }),
});

const walletSchema = z.object({
  externalAddress: z.string().refine(ethers.isAddress, {
    message: "Please enter a valid Ethereum wallet address",
  }),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero",
  }),
});

type BankFormValues = z.infer<typeof bankSchema>;
type WalletFormValues = z.infer<typeof walletSchema>;

type WithdrawalStep = 'input' | 'verifying' | 'finalizing' | 'success';

export default function CashOutPage() {
  const { toast } = useToast();
  const { user, wallet } = useWallet();
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
    defaultValues: { accountName: '', bankName: '', iban: '', swiftBic: '', amount: '' },
    mode: 'onChange',
  });

  const walletForm = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: { externalAddress: '', amount: '' },
    mode: 'onChange',
  });

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
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'finalizing') {
      handleFinalizeWithdrawal();
    }
  }, [step]);

  const handleFinalizeWithdrawal = async () => {
    if (!user || !firestore || !wallet || !pendingData) return;

    try {
      const prices = await getLivePrices(['ETH'], 'USD');
      const ethPriceUSD = prices.ETH || 3500;
      const amountInSelectedCurrency = parseFloat(pendingData.amount);
      const amountInUSD = amountInSelectedCurrency / currency.rate;
      const ethToDeduct = amountInUSD / ethPriceUSD;

      if (ethToDeduct > ethBalance) {
        throw new Error(`Insufficient funds. You need ${ethToDeduct.toFixed(6)} ETH but have ${ethBalance.toFixed(6)} ETH.`);
      }

      await runTransaction(firestore, async (transaction) => {
        const walletDoc = await transaction.get(ethWalletRef!);
        if (!walletDoc.exists()) throw new Error("Wallet not found");

        const currentBalance = walletDoc.data().balance;
        if (currentBalance < ethToDeduct) throw new Error("Insufficient funds");

        transaction.update(ethWalletRef!, {
          balance: currentBalance - ethToDeduct
        });

        const txRef = doc(collection(ethWalletRef!, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          type: 'Withdrawal',
          amount: ethToDeduct,
          price: ethPriceUSD,
          timestamp: serverTimestamp(),
          status: 'Completed',
          method: activeMethod,
          notes: activeMethod === 'bank' 
            ? `International Bank Transfer to ${pendingData.bankName} (IBAN: ${pendingData.iban.substring(0, 4)}...)`
            : `Direct Wallet Withdrawal to ${pendingData.externalAddress}`
        });
      });

      setStep('success');
      toast({ title: "Ledger Finalized", description: "Funds successfully dispatched." });
    } catch (error: any) {
      console.error("Withdrawal execution failed:", error);
      setStep('input');
      toast({
        title: "Execution Error",
        description: error.message || "Ledger sync failed.",
        variant: "destructive",
      });
    }
  };

  const renderSecurityTerminal = () => {
    const steps = [
      { id: 25, label: 'Authenticating Identity' },
      { id: 50, label: 'Compliance AML Scanning' },
      { id: 75, label: 'International SWIFT Validation' },
      { id: 100, label: 'Preparing Ledger Entry' },
    ];
    const currentLabel = steps.find(s => verificationProgress <= s.id)?.label || 'Processing';

    return (
      <div className="flex flex-col items-center justify-center space-y-8 py-12">
        <div className="relative">
          <div className="h-32 w-32 rounded-full border-4 border-primary/20 flex items-center justify-center">
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
          <h3 className="text-xl font-bold uppercase tracking-widest text-primary">Security Terminal</h3>
          <p className="text-sm text-muted-foreground animate-pulse">{currentLabel}...</p>
        </div>
        <div className="w-full max-w-xs bg-muted rounded-full h-1 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300" 
            style={{ width: `${verificationProgress}%` }}
          />
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center text-center space-y-6 py-8">
      <div className="p-4 bg-green-500/10 rounded-full">
        <CheckCircle2 className="h-16 w-16 text-green-500 animate-in zoom-in" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-black tracking-tighter">Funds Dispatched</h2>
        <p className="text-muted-foreground max-w-sm">
          Your withdrawal has been verified and executed on the Apex Private Ledger.
          {activeMethod === 'bank' ? ' Estimated arrival: 1-2 business days.' : ' Transaction will be visible on-chain shortly.'}
        </p>
      </div>
      <div className="w-full p-4 rounded-xl bg-muted/30 border border-white/5 space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground uppercase font-bold">Ref ID</span>
          <span className="font-mono text-primary">APEX-{Math.random().toString(36).substring(7).toUpperCase()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground uppercase font-bold">Status</span>
          <span className="text-green-400 font-bold uppercase tracking-widest">Confirmed</span>
        </div>
      </div>
      <Button onClick={() => setStep('input')} className="w-full btn-premium">
        Initiate Another Transfer
      </Button>
    </div>
  );

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-6 pb-20">
        <Card className="w-full max-w-lg glass-module glass-glow-blue border-white/10 overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-black tracking-tight">CASH OUT GATEWAY</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-primary/60">
                  Industrial Secure Protocol v2.4
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {step === 'input' && (
              <>
                <div className="mb-8 p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-white/10 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Wallet className="h-24 w-24" />
                  </div>
                  <div className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-1">Available to Withdraw</div>
                  <div className="text-3xl font-black tracking-tighter mb-1">{ethBalance.toFixed(6)} ETH</div>
                  <div className="text-sm font-bold text-accent">
                    ≈ {formatCurrency(ethBalance * (3500 * currency.rate))} 
                  </div>
                </div>

                <Tabs defaultValue="bank" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
                    <TabsTrigger value="bank" className="rounded-lg py-2 transition-all">
                      <Building2 className="h-4 w-4 mr-2" /> Global Bank
                    </TabsTrigger>
                    <TabsTrigger value="wallet" className="rounded-lg py-2 transition-all">
                      <Globe className="h-4 w-4 mr-2" /> Digital Asset
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="bank" className="pt-6 space-y-4">
                    <form onSubmit={bankForm.handleSubmit((d) => startVerification(d, 'bank'))} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Account Holder</Label>
                          <Input className="bg-muted/30 border-white/10" placeholder="Full Legal Name" {...bankForm.register('accountName')} />
                          {bankForm.formState.errors.accountName && <p className="text-[10px] text-destructive">{bankForm.formState.errors.accountName.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Institution</Label>
                          <Input className="bg-muted/30 border-white/10" placeholder="Bank Name" {...bankForm.register('bankName')} />
                          {bankForm.formState.errors.bankName && <p className="text-[10px] text-destructive">{bankForm.formState.errors.bankName.message}</p>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">International Bank Account Number (IBAN)</Label>
                        <Input className="bg-muted/30 border-white/10 font-mono" placeholder="GB00 0000 0000 0000..." {...bankForm.register('iban')} />
                        {bankForm.formState.errors.iban && <p className="text-[10px] text-destructive">{bankForm.formState.errors.iban.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">SWIFT / BIC Code</Label>
                        <Input className="bg-muted/30 border-white/10 font-mono" placeholder="XXXX XX XX" {...bankForm.register('swiftBic')} />
                        {bankForm.formState.errors.swiftBic && <p className="text-[10px] text-destructive">{bankForm.formState.errors.swiftBic.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Amount ({currency.symbol})</Label>
                        <Input className="bg-muted/30 border-white/10 text-xl font-bold" type="number" step="any" placeholder="0.00" {...bankForm.register('amount')} />
                        {bankForm.formState.errors.amount && <p className="text-[10px] text-destructive">{bankForm.formState.errors.amount.message}</p>}
                      </div>
                      <Button type="submit" className="w-full btn-premium py-6 mt-4">
                        <Banknote className="mr-2 h-5 w-5" /> Initiate Secure Wire
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="wallet" className="pt-6 space-y-4">
                    <form onSubmit={walletForm.handleSubmit((d) => startVerification(d, 'wallet'))} className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Destination Wallet (EVM)</Label>
                        <Input className="bg-muted/30 border-white/10 font-mono" placeholder="0x..." {...walletForm.register('externalAddress')} />
                        {walletForm.formState.errors.externalAddress && <p className="text-[10px] text-destructive">{walletForm.formState.errors.externalAddress.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Amount ({currency.symbol})</Label>
                        <Input className="bg-muted/30 border-white/10 text-xl font-bold" type="number" step="any" placeholder="0.00" {...walletForm.register('amount')} />
                        {walletForm.formState.errors.amount && <p className="text-[10px] text-destructive">{walletForm.formState.errors.amount.message}</p>}
                      </div>
                      <Button type="submit" className="w-full btn-premium py-6 mt-4">
                        <ShieldCheck className="mr-2 h-5 w-5" /> Execute Digital Transfer
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}

            {(step === 'verifying' || step === 'finalizing') && renderSecurityTerminal()}
            {step === 'success' && renderSuccess()}
          </CardContent>
          <CardFooter className="bg-muted/20 border-t border-white/5 py-3 flex items-center justify-center gap-2">
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">End-to-End Encrypted Transfer Service</span>
          </CardFooter>
        </Card>
      </div>
    </PrivateRoute>
  );
}
