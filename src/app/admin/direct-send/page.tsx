'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wallet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  runTransaction,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { marketCoins } from '@/lib/data';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, 'Recipient address is required.'),
  amount: z.string().refine((val) => parseFloat(val) > 0, {
    message: 'Amount must be greater than zero.',
  }),
  asset: z.string().min(1, 'Asset is required.'),
  notes: z.string().optional(),
});

type SendFormValues = z.infer<typeof sendSchema>;
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function FundWalletPage() {
  const { toast } = useToast();
  const { user: adminUser } = useWallet();
  const firestore = useFirestore();

  const [status, setStatus] = useState<SendStatus>('idle');
  const [lastTransaction, setLastTransaction] = useState<{
    amount: string;
    recipient: string;
    asset: string;
    recipientEmail: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
    setValue,
  } = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: { recipientAddress: '', amount: '', asset: 'ETH', notes: '' },
    mode: 'onChange',
  });

  const formValues = watch();

  const executeSend: SubmitHandler<SendFormValues> = async (data) => {
    if (!adminUser || !firestore) {
      toast({ title: 'Cannot process', description: 'Admin session is missing.', variant: 'destructive' });
      return;
    }

    setStatus('sending');
    const amount = parseFloat(data.amount);

    try {
      // ── Step 1: Resolve recipient BEFORE the transaction ──────────────────
      // getDocs must NOT be called inside runTransaction — it is not transactionally
      // isolated. We resolve the recipient doc ref first, then use transaction.get()
      // inside the transaction to do the transactionally-safe read.
      const usersRef = collection(firestore, 'users');
      const recipientQuery = query(
        usersRef,
        where('walletAddress', '==', data.recipientAddress),
        limit(1)
      );
      const recipientSnapshot = await getDocs(recipientQuery);

      if (recipientSnapshot.empty) {
        throw new Error('No user found with that wallet address.');
      }

      const recipientDoc = recipientSnapshot.docs[0];
      const recipientUserId = recipientDoc.id;
      const recipientEmail = (recipientDoc.data().email as string) ?? 'unknown';

      // ── Step 2: Run the atomic ledger update ──────────────────────────────
      await runTransaction(firestore, async (transaction) => {
        const walletRef = doc(firestore, 'users', recipientUserId, 'wallets', data.asset);
        const walletSnap = await transaction.get(walletRef);
        const currentBalance = walletSnap.exists() ? (walletSnap.data().balance ?? 0) : 0;

        // Credit the wallet
        transaction.set(
          walletRef,
          {
            balance: currentBalance + amount,
            currency: data.asset,
            id: data.asset,
            userId: recipientUserId,
          },
          { merge: true }
        );

        // Append an audit transaction record
        const txRef = doc(collection(walletRef, 'transactions'));
        transaction.set(txRef, {
          userId: recipientUserId,
          type: 'Buy',
          amount,
          price: 0,
          timestamp: serverTimestamp(),
          notes: data.notes?.trim()
            ? `Admin funding: ${data.notes.trim()} (by ${adminUser.email})`
            : `Admin funding by ${adminUser.email}`,
          fundedBy: adminUser.email,
          adminAction: true,
        });
      });

      setLastTransaction({
        amount: data.amount,
        recipient: data.recipientAddress,
        asset: data.asset,
        recipientEmail,
      });
      setStatus('success');
      reset({ asset: data.asset });
    } catch (error: any) {
      console.error('Fund wallet failed:', error);
      setStatus('error');
      toast({
        title: 'Transaction Failed',
        description: error.message || 'Could not complete the ledger update.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Fund Wallet</h1>
        <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">
          Admin Direct Credit — Instant Ledger Update
        </p>
      </div>

      <Alert className="bg-amber-500/5 border-amber-500/20">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-[11px] text-amber-400">
          This action directly credits a user's wallet balance and creates an audited transaction record.
          All funding events are logged with your admin identity. Use only for legitimate administrative purposes.
        </AlertDescription>
      </Alert>

      <Card className="glass-module border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Credit User Wallet
          </CardTitle>
          <CardDescription>
            Instantly credit any supported asset to a user account. The transaction is recorded in their history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'idle' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Asset</Label>
                <Select
                  defaultValue="ETH"
                  onValueChange={(val) => setValue('asset', val, { shouldValidate: true })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10">
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketCoins.map((coin) => (
                      <SelectItem key={coin.symbol} value={coin.symbol}>
                        <div className="flex items-center gap-2">
                          <CryptoIcon name={coin.name} className="h-4 w-4" />
                          <span>{coin.name}</span>
                          <span className="text-muted-foreground text-xs">{coin.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientAddress" className="text-[10px] font-black uppercase tracking-widest">
                  Recipient Wallet Address
                </Label>
                <Input
                  id="recipientAddress"
                  placeholder="0x..."
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-mono text-sm"
                  {...register('recipientAddress')}
                />
                {errors.recipientAddress && (
                  <p className="text-sm text-destructive">{errors.recipientAddress.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-widest">
                  Amount ({formValues.asset})
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  step="any"
                  min="0"
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-mono"
                  {...register('amount')}
                />
                {errors.amount && (
                  <p className="text-sm text-destructive">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest">
                  Admin Notes <span className="text-muted-foreground normal-case font-normal">(optional)</span>
                </Label>
                <Input
                  id="notes"
                  placeholder="Reason for funding (e.g. promotional credit, support resolution)"
                  className="h-11 rounded-xl bg-white/5 border-white/10"
                  {...register('notes')}
                />
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full btn-premium py-6 rounded-2xl font-black uppercase tracking-widest"
                    disabled={!isValid}
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Review & Execute
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Admin Funding</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 text-sm">
                        <p>You are about to credit the following:</p>
                        <div className="rounded-xl bg-muted/30 p-4 space-y-1.5 text-left font-mono text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Asset</span>
                            <span className="font-bold">{formValues.asset}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-bold">{formValues.amount}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground shrink-0">To address</span>
                            <span className="font-bold truncate">
                              {formValues.recipientAddress
                                ? `${formValues.recipientAddress.slice(0, 12)}...${formValues.recipientAddress.slice(-6)}`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Actioned by</span>
                            <span className="font-bold">{adminUser?.email ?? 'admin'}</span>
                          </div>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          This action cannot be undone. The credit will appear immediately in the user's balance.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit(executeSend)}>
                      Confirm & Credit Wallet
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {status === 'sending' && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="text-lg font-semibold text-primary">Executing Ledger Update...</h3>
              <p className="text-sm text-muted-foreground">Writing to Firestore atomically. Please wait.</p>
            </div>
          )}

          {status === 'success' && lastTransaction && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Wallet Credited</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="text-white font-bold">
                    {lastTransaction.amount} {lastTransaction.asset}
                  </span>{' '}
                  credited to{' '}
                  <span className="text-white font-semibold">{lastTransaction.recipientEmail}</span>
                </p>
                <p className="font-mono text-xs">
                  {lastTransaction.recipient.slice(0, 18)}...{lastTransaction.recipient.slice(-6)}
                </p>
              </div>
              <Button className="btn-premium rounded-xl" onClick={() => setStatus('idle')}>
                Fund Another Wallet
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Transaction Failed</h3>
              <p className="text-sm text-muted-foreground">
                The ledger update could not complete. Check the wallet address and try again.
              </p>
              <Button variant="outline" className="rounded-xl" onClick={() => setStatus('idle')}>
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
