
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ethers } from 'ethers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Banknote, Wallet, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { getLivePrices } from '@/services/crypto-service';

const bankSchema = z.object({
  accountName: z.string().min(2, "Account holder name is required"),
  bankName: z.string().min(2, "Bank name is required"),
  accountNumber: z.string().min(8, "Valid IBAN or Account Number is required"),
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

export default function CashOutPage() {
  const { toast } = useToast();
  const { user, wallet } = useWallet();
  const { currency, formatCurrency } = useCurrency();
  const firestore = useFirestore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const ethWalletRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'wallets', 'ETH');
  }, [user, firestore]);

  const { data: ethWallet } = useDoc<{ balance: number }>(ethWalletRef);
  const ethBalance = ethWallet?.balance ?? 0;

  const bankForm = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: { accountName: '', bankName: '', accountNumber: '', amount: '' },
    mode: 'onChange',
  });

  const walletForm = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: { externalAddress: '', amount: '' },
    mode: 'onChange',
  });

  const handleWithdrawal = async (data: any, method: 'bank' | 'wallet') => {
    if (!user || !firestore || !wallet) return;

    setIsProcessing(true);
    try {
      const prices = await getLivePrices(['ETH'], 'USD');
      const ethPriceUSD = prices.ETH || 0;
      const amountInSelectedCurrency = parseFloat(data.amount);
      
      // Calculate ETH amount based on if user entered amount in fiat or crypto
      // For this UI, let's assume the user enters amount in their display currency
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
          notes: method === 'bank' 
            ? `Withdrawal to ${data.bankName} (${data.accountNumber})`
            : `Withdrawal to external wallet ${data.externalAddress}`
        });
      });

      setIsSuccess(true);
      toast({ title: "Withdrawal Successful", description: `Funds are on their way.` });
      bankForm.reset();
      walletForm.reset();
    } catch (error: any) {
      console.error("Withdrawal failed:", error);
      toast({
        title: "Withdrawal Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <PrivateRoute>
        <div className="flex justify-center items-start pt-12">
          <Card className="w-full max-w-md text-center py-12">
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <CheckCircle2 className="h-20 w-20 text-green-500 animate-in zoom-in duration-300" />
              </div>
              <h2 className="text-3xl font-bold">Funds Sent!</h2>
              <p className="text-muted-foreground">
                Your withdrawal request has been processed. Depending on your bank, funds should arrive within 1-3 business days.
              </p>
              <Button onClick={() => setIsSuccess(false)} className="w-full">
                Make Another Withdrawal
              </Button>
            </CardContent>
          </Card>
        </div>
      </PrivateRoute>
    );
  }

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Cash Out</CardTitle>
            <CardDescription>
              Withdraw your funds securely to your bank account or an external wallet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="text-sm text-muted-foreground">Available Balance</div>
              <div className="text-2xl font-bold">{ethBalance.toFixed(6)} ETH</div>
              <div className="text-sm font-medium text-primary">
                ≈ {formatCurrency(ethBalance * (3500 * currency.rate))} 
              </div>
            </div>

            <Tabs defaultValue="bank" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bank" className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" /> Bank Account
                </TabsTrigger>
                <TabsTrigger value="wallet" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> External Wallet
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bank" className="pt-6 space-y-4">
                <form onSubmit={bankForm.handleSubmit((d) => handleWithdrawal(d, 'bank'))} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountName">Account Holder Name</Label>
                    <Input id="accountName" placeholder="John Doe" {...bankForm.register('accountName')} />
                    {bankForm.formState.errors.accountName && <p className="text-xs text-destructive">{bankForm.formState.errors.accountName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input id="bankName" placeholder="Global Bank" {...bankForm.register('bankName')} />
                    {bankForm.formState.errors.bankName && <p className="text-xs text-destructive">{bankForm.formState.errors.bankName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number / IBAN</Label>
                    <Input id="accountNumber" placeholder="GB00 0000 0000 0000" {...bankForm.register('accountNumber')} />
                    {bankForm.formState.errors.accountNumber && <p className="text-xs text-destructive">{bankForm.formState.errors.accountNumber.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAmount">Amount to Cash Out ({currency.symbol})</Label>
                    <Input id="bankAmount" type="number" step="any" placeholder="0.00" {...bankForm.register('amount')} />
                    {bankForm.formState.errors.amount && <p className="text-xs text-destructive">{bankForm.formState.errors.amount.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin mr-2" /> : "Initiate Bank Transfer"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="wallet" className="pt-6 space-y-4">
                <form onSubmit={walletForm.handleSubmit((d) => handleWithdrawal(d, 'wallet'))} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="externalAddress">External ETH Wallet Address</Label>
                    <Input id="externalAddress" placeholder="0x..." {...walletForm.register('externalAddress')} />
                    {walletForm.formState.errors.externalAddress && <p className="text-xs text-destructive">{walletForm.formState.errors.externalAddress.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="walletAmount">Amount to Withdraw ({currency.symbol})</Label>
                    <Input id="walletAmount" type="number" step="any" placeholder="0.00" {...walletForm.register('amount')} />
                    {walletForm.formState.errors.amount && <p className="text-xs text-destructive">{walletForm.formState.errors.amount.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin mr-2" /> : "Withdraw to Wallet"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
