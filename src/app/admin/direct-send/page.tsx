'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wallet, CheckCircle, XCircle, AlertTriangle, Search, User } from 'lucide-react';
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
import { useSearchParams } from 'next/navigation';
import { marketCoins } from '@/lib/data';
import { AdminRoute } from '@/components/admin/admin-route';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, 'Recipient address or email is required.'),
  amount: z.string().refine((val) => parseFloat(val) > 0, {
    message: 'Amount must be greater than zero.',
  }),
  asset: z.string().min(1, 'Asset is required.'),
  notes: z.string().optional(),
});

type SendFormValues = z.infer<typeof sendSchema>;
type SendStatus = 'idle' | 'searching' | 'confirming' | 'sending' | 'success' | 'error';

function FundWalletForm() {
  const { toast } = useToast();
  const { user: adminUser } = useWallet();
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<SendStatus>('idle');
  const [recipientInfo, setRecipientInfo] = useState<{
    userId: string;
    email: string;
    walletAddress: string;
  } | null>(null);
  
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
    defaultValues: { 
      recipientAddress: searchParams.get('address') || searchParams.get('email') || '', 
      amount: '', 
      asset: searchParams.get('asset') || 'ETH', 
      notes: '' 
    },
    mode: 'onChange',
  });

  const formValues = watch();

  // Auto-fill and search if params provided
  useEffect(() => {
    const addr = searchParams.get('address') || searchParams.get('email');
    if (addr && firestore && status === 'idle') {
      handleSubmit(handleReview)();
    }
  }, [firestore]);

  const handleReview = async (data: SendFormValues) => {
    if (!firestore) return;
    setStatus('searching');
    setRecipientInfo(null);
    
    try {
      const input = data.recipientAddress.trim();
      const usersRef = collection(firestore, 'users');
      
      // We avoid collectionGroup queries to prevent "insufficient permissions" errors 
      // when indexes or specific rules are missing.
      
      let foundDoc: any = null;

      // 1. Search by exact Email (Case-insensitive)
      const qEmail = query(usersRef, where('email', '==', input.toLowerCase()), limit(1));
      const sEmail = await getDocs(qEmail);
      if (!sEmail.empty) foundDoc = sEmail.docs[0];

      // 2. Search by Primary Wallet Address
      if (!foundDoc) {
        const qAddr = query(usersRef, where('walletAddressLowercase', '==', input.toLowerCase()), limit(1));
        const sAddr = await getDocs(qAddr);
        if (!sAddr.empty) foundDoc = sAddr.docs[0];
      }

      // 3. Search by UID (Direct match)
      if (!foundDoc) {
        const qUid = query(usersRef, where('id', '==', input), limit(1));
        const sUid = await getDocs(qUid);
        if (!sUid.empty) foundDoc = sUid.docs[0];
      }

      if (foundDoc) {
        const d = foundDoc.data();
        setRecipientInfo({ 
          userId: foundDoc.id, 
          email: d.email || 'No Email', 
          walletAddress: d.walletAddress || 'No Address' 
        });
        setStatus('confirming');
      } else {
        throw new Error('No user found with that email or primary wallet address.');
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setStatus('idle');
      toast({ 
        title: 'User Not Found', 
        description: error.message || 'Check the details and try again.', 
        variant: 'destructive' 
      });
    }
  };

  const executeSend = async () => {
    if (!adminUser || !firestore || !recipientInfo) {
      toast({ title: 'Cannot process', description: 'Session or recipient missing.', variant: 'destructive' });
      return;
    }

    setStatus('sending');
    const amount = parseFloat(formValues.amount);

    try {
      await runTransaction(firestore, async (transaction) => {
        const walletRef = doc(firestore, 'users', recipientInfo.userId, 'wallets', formValues.asset);
        const walletSnap = await transaction.get(walletRef);
        
        const currentBalance = walletSnap.exists() ? (walletSnap.data().balance ?? 0) : 0;

        // Update Balance
        transaction.set(
          walletRef,
          {
            balance: currentBalance + amount,
            currency: formValues.asset,
            id: formValues.asset,
            userId: recipientInfo.userId,
            lastSynced: serverTimestamp(),
          },
          { merge: true }
        );

        // Record Audit Transaction
        const txRef = doc(collection(walletRef, 'transactions'));
        transaction.set(txRef, {
          userId: recipientInfo.userId,
          type: 'Buy',
          amount,
          price: 0,
          status: 'Completed',
          timestamp: serverTimestamp(),
          notes: formValues.notes?.trim()
            ? `Admin funding: ${formValues.notes.trim()}`
            : `Administrative Ledger Credit`,
          fundedBy: adminUser.email,
          adminAction: true,
          referenceNo: 'ADM-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        });
      });

      setLastTransaction({
        amount: formValues.amount,
        recipient: recipientInfo.walletAddress,
        asset: formValues.asset,
        recipientEmail: recipientInfo.email,
      });
      setStatus('success');
      reset({ asset: formValues.asset });
    } catch (error: any) {
      console.error('Fund wallet failed:', error);
      setStatus('error');
      toast({
        title: 'Ledger Update Failed',
        description: error.message || 'A permission or network error occurred.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-500/5 border-amber-500/20">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-[11px] text-amber-400 font-medium">
          CRITICAL: This tool performs direct ledger manipulation. All actions are audited and linked to {adminUser?.email}.
        </AlertDescription>
      </Alert>

      <Card className="glass-module border-white/5 bg-black/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Credit User Balance
          </CardTitle>
          <CardDescription className="text-xs">
            Manually increase a user's balance. This creates a "Buy" transaction in their history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(status === 'idle' || status === 'searching') && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Asset</Label>
                <Select
                  value={formValues.asset}
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
                          <span className="font-bold">{coin.symbol}</span>
                          <span className="text-muted-foreground text-xs">{coin.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientAddress" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  User Email or Primary Wallet Address
                </Label>
                <div className="relative">
                  <Input
                    id="recipientAddress"
                    placeholder="Enter email or 0x address..."
                    className="h-11 rounded-xl bg-white/5 border-white/10 font-mono text-sm pl-10"
                    {...register('recipientAddress')}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                </div>
                {errors.recipientAddress && (
                  <p className="text-xs text-destructive font-bold">{errors.recipientAddress.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Amount to Credit
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  step="any"
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-mono"
                  {...register('amount')}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive font-bold">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Administrative Note
                </Label>
                <Input
                  id="notes"
                  placeholder="Reason for manual credit..."
                  className="h-11 rounded-xl bg-white/5 border-white/10"
                  {...register('notes')}
                />
              </div>

              <Button
                className="w-full btn-premium py-6 rounded-2xl font-black uppercase tracking-widest"
                disabled={!isValid || status === 'searching'}
                onClick={handleSubmit(handleReview)}
              >
                {status === 'searching' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying User...</>
                ) : (
                  <><Search className="mr-2 h-4 w-4" /> Review Credit</>
                )}
              </Button>
            </div>
          )}

          {status === 'confirming' && recipientInfo && (
             <div className="space-y-6">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
                   <h3 className="text-lg font-bold italic uppercase tracking-tight flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" /> Recipient Verified
                   </h3>
                   <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between border-b border-white/5 pb-2">
                         <span className="text-muted-foreground">ACCOUNT EMAIL</span>
                         <span className="text-foreground font-black">{recipientInfo.email}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                         <span className="text-muted-foreground">CREDIT ASSET</span>
                         <span className="text-foreground font-black uppercase">{formValues.asset}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                         <span className="text-muted-foreground">NEW CREDIT</span>
                         <span className="text-green-400 font-black">+{formValues.amount} {formValues.asset}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                         <span className="text-muted-foreground">ROOT ADDRESS</span>
                         <span className="text-foreground break-all opacity-60">{recipientInfo.walletAddress}</span>
                      </div>
                   </div>
                </div>

                <div className="flex gap-3">
                   <Button variant="outline" className="flex-1 rounded-2xl h-12 font-bold" onClick={() => setStatus('idle')}>
                      Cancel
                   </Button>
                   <Button className="flex-1 btn-premium rounded-2xl h-12 font-black uppercase tracking-widest" onClick={executeSend}>
                      Confirm & Send
                   </Button>
                </div>
             </div>
          )}

          {status === 'sending' && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="text-lg font-bold uppercase tracking-widest text-primary">Executing Transaction</h3>
              <p className="text-xs text-muted-foreground font-bold uppercase">Writing to Private Ledger...</p>
            </div>
          )}

          {status === 'success' && lastTransaction && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-black uppercase italic">Transaction Confirmed</h3>
              <div className="text-sm text-muted-foreground space-y-2 max-w-xs mx-auto font-medium">
                <p>
                  Successfully credited <span className="text-green-400 font-black">{lastTransaction.amount} {lastTransaction.asset}</span> to:
                </p>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 font-mono">
                   <p className="text-white font-bold">{lastTransaction.recipientEmail}</p>
                   <p className="text-[10px] opacity-40 mt-1">{lastTransaction.recipient.slice(0, 24)}...</p>
                </div>
              </div>
              <Button className="btn-premium rounded-2xl px-8 h-12 font-black uppercase tracking-widest mt-4" onClick={() => setStatus('idle')}>
                Done
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight">Access Denied or Conflict</h3>
              <p className="text-xs text-muted-foreground font-medium max-w-xs">
                The administrative transaction was rejected by the ledger security layer.
              </p>
              <Button variant="outline" className="rounded-2xl mt-4 px-8" onClick={() => setStatus('idle')}>
                Review Details
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FundWalletPage() {
  return (
    <AdminRoute>
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Fund Wallet</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">
            Internal Ledger Credit — Admin Oversight
          </p>
        </div>
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>}>
          <FundWalletForm />
        </Suspense>
      </div>
    </AdminRoute>
  );
}
