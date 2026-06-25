'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wallet, CheckCircle, XCircle, AlertTriangle, Search, User, Waves, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import {
  collection, query, where, getDocs, limit,
  runTransaction, doc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import { useSearchParams } from 'next/navigation';
import { marketCoins } from '@/lib/data';
import { AdminRoute } from '@/components/admin/admin-route';
import { cn } from '@/lib/utils';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, 'Recipient address or email is required.'),
  amount: z.string().refine((val) => parseFloat(val) > 0, { message: 'Amount must be greater than zero.' }),
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
  const [recipientInfo, setRecipientInfo] = useState<{ userId: string; email: string; walletAddress: string } | null>(null);
  const [whaleBalance, setWhaleBalance] = useState<number | null>(null);
  const [lastTransaction, setLastTransaction] = useState<{ amount: string; recipient: string; asset: string; recipientEmail: string } | null>(null);

  const { register, handleSubmit, formState: { errors, isValid }, watch, reset, setValue } = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: {
      recipientAddress: searchParams.get('address') || searchParams.get('email') || '',
      amount: '',
      asset: searchParams.get('asset') || 'ETH',
      notes: '',
    },
    mode: 'onChange',
  });

  const formValues = watch();

  // Load whale balance when asset changes
  useEffect(() => {
    if (!firestore || !formValues.asset) return;
    const fetchWhale = async () => {
      const whaleRef = doc(firestore, 'whale_treasury', 'balances');
      const snap = await getDoc(whaleRef);
      if (snap.exists()) {
        const data = snap.data();
        setWhaleBalance(data[formValues.asset] ?? 0);
      } else {
        setWhaleBalance(0);
      }
    };
    fetchWhale();
  }, [firestore, formValues.asset]);

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
      let foundDoc: any = null;

      const qEmail = query(usersRef, where('email', '==', input.toLowerCase()), limit(1));
      const sEmail = await getDocs(qEmail);
      if (!sEmail.empty) foundDoc = sEmail.docs[0];

      if (!foundDoc) {
        const qAddr = query(usersRef, where('walletAddressLowercase', '==', input.toLowerCase()), limit(1));
        const sAddr = await getDocs(qAddr);
        if (!sAddr.empty) foundDoc = sAddr.docs[0];
      }

      if (!foundDoc) {
        const qUid = query(usersRef, where('id', '==', input), limit(1));
        const sUid = await getDocs(qUid);
        if (!sUid.empty) foundDoc = sUid.docs[0];
      }

      if (foundDoc) {
        const d = foundDoc.data();
        setRecipientInfo({ userId: foundDoc.id, email: d.email || 'No Email', walletAddress: d.walletAddress || 'No Address' });
        setStatus('confirming');
      } else {
        throw new Error('No user found with that email or primary wallet address.');
      }
    } catch (error: any) {
      setStatus('idle');
      toast({ title: 'User Not Found', description: error.message || 'Check the details and try again.', variant: 'destructive' });
    }
  };

  const executeSend = async () => {
    if (!adminUser || !firestore || !recipientInfo) return;
    setStatus('sending');
    const amount = parseFloat(formValues.amount);

    try {
      await runTransaction(firestore, async (transaction) => {
        const walletRef = doc(firestore, 'users', recipientInfo.userId, 'wallets', formValues.asset);
        const whaleRef = doc(firestore, 'whale_treasury', 'balances');

        const [walletSnap, whaleSnap] = await Promise.all([
          transaction.get(walletRef),
          transaction.get(whaleRef),
        ]);

        const currentBalance = walletSnap.exists() ? (walletSnap.data().balance ?? 0) : 0;
        const whaleData = whaleSnap.exists() ? whaleSnap.data() : {};
        const whaleCurrentBalance = whaleData[formValues.asset] ?? 0;

        if (whaleCurrentBalance < amount) {
          throw new Error(`Whale Treasury has insufficient ${formValues.asset}. Available: ${whaleCurrentBalance.toFixed(6)}`);
        }

        // Deduct from whale treasury
        transaction.set(whaleRef, {
          ...whaleData,
          [formValues.asset]: whaleCurrentBalance - amount,
          lastUpdated: serverTimestamp(),
        });

        // Credit user wallet
        transaction.set(walletRef, {
          balance: currentBalance + amount,
          currency: formValues.asset,
          id: formValues.asset,
          userId: recipientInfo.userId,
          lastSynced: serverTimestamp(),
        }, { merge: true });

        // Audit log
        const txRef = doc(collection(walletRef, 'transactions'));
        transaction.set(txRef, {
          userId: recipientInfo.userId,
          type: 'Buy',
          amount,
          price: 0,
          status: 'Completed',
          timestamp: serverTimestamp(),
          notes: formValues.notes?.trim() ? `Admin funding: ${formValues.notes.trim()}` : 'Administrative Ledger Credit',
          fundedBy: adminUser.email,
          adminAction: true,
          sourceWallet: 'whale_treasury',
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
      toast({ title: 'Transaction Failed', description: error.message || 'A permission or network error occurred.', variant: 'destructive' });
    }
  };

  const amountNum = parseFloat(formValues.amount) || 0;
  const insufficientWhale = whaleBalance !== null && amountNum > whaleBalance;

  return (
    <div className="space-y-5 max-w-lg">
      {/* Whale balance indicator */}
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-cyan-500/15 bg-cyan-500/5">
        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <Waves className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-400/60">Whale Treasury</p>
          <p className="text-sm font-bold text-cyan-300 tabular-nums">
            {whaleBalance === null ? '—' : `${whaleBalance.toFixed(6)} ${formValues.asset}`}
          </p>
        </div>
        <a href="/admin/whale" className="text-[10px] font-semibold text-cyan-400/50 hover:text-cyan-400 transition-colors flex items-center gap-1">
          Manage <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/15 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-amber-400/80 font-medium leading-relaxed">
          CRITICAL: Direct ledger manipulation. All actions are audited and linked to {adminUser?.email}.
          Funds are debited from the Whale Treasury.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 p-6 space-y-5">
        {(status === 'idle' || status === 'searching') && (
          <>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Asset</Label>
              <Select value={formValues.asset} onValueChange={(val) => setValue('asset', val, { shouldValidate: true })}>
                <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/8 text-sm">
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0C12] border-white/10">
                  {marketCoins.map((coin) => (
                    <SelectItem key={coin.symbol} value={coin.symbol}>
                      <div className="flex items-center gap-2">
                        <CryptoIcon name={coin.name} className="h-4 w-4" />
                        <span className="font-bold">{coin.symbol}</span>
                        <span className="text-white/40 text-xs">{coin.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">User Email or Wallet Address</Label>
              <div className="relative">
                <Input
                  placeholder="user@example.com or 0x..."
                  className="h-11 rounded-xl bg-white/5 border-white/8 font-mono text-sm pl-10"
                  {...register('recipientAddress')}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              </div>
              {errors.recipientAddress && <p className="text-xs text-red-400">{errors.recipientAddress.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Amount to Credit</Label>
              <Input
                type="number" placeholder="0.00" step="any"
                className={cn("h-11 rounded-xl bg-white/5 border-white/8 font-mono", insufficientWhale && "border-red-500/40")}
                {...register('amount')}
              />
              {insufficientWhale && (
                <p className="text-xs text-red-400">Exceeds Whale Treasury balance ({whaleBalance?.toFixed(6)} {formValues.asset})</p>
              )}
              {errors.amount && <p className="text-xs text-red-400">{errors.amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Admin Note</Label>
              <Input
                placeholder="Reason for manual credit..."
                className="h-11 rounded-xl bg-white/5 border-white/8"
                {...register('notes')}
              />
            </div>

            <button
              className={cn(
                "w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2",
                (!isValid || insufficientWhale || status === 'searching')
                  ? "bg-white/5 text-white/20 cursor-not-allowed"
                  : "btn-premium text-white"
              )}
              disabled={!isValid || insufficientWhale || status === 'searching'}
              onClick={handleSubmit(handleReview)}
            >
              {status === 'searching' ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : <><Search className="h-4 w-4" /> Review Credit</>}
            </button>
          </>
        )}

        {status === 'confirming' && recipientInfo && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-3">
              <h3 className="text-sm font-bold text-violet-300 flex items-center gap-2 uppercase tracking-widest">
                <User className="h-4 w-4" /> Recipient Verified
              </h3>
              <div className="space-y-2.5 font-mono text-xs">
                {[
                  { label: 'Account', value: recipientInfo.email },
                  { label: 'Asset', value: formValues.asset },
                  { label: 'Credit', value: `+${formValues.amount} ${formValues.asset}`, green: true },
                ].map(row => (
                  <div key={row.label} className="flex justify-between border-b border-white/[0.04] pb-2">
                    <span className="text-white/30">{row.label}</span>
                    <span className={row.green ? 'text-emerald-400 font-black' : 'text-white/80'}>{row.value}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-white/30">Source</span>
                  <span className="text-cyan-400 font-semibold flex items-center gap-1"><Waves className="h-3 w-3" /> Whale Treasury</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-2xl h-12 border-white/10 text-white/50" onClick={() => setStatus('idle')}>
                Cancel
              </Button>
              <button className="flex-1 btn-premium rounded-2xl h-12 font-black uppercase tracking-widest text-sm text-white" onClick={executeSend}>
                Confirm & Send
              </button>
            </div>
          </div>
        )}

        {status === 'sending' && (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-violet-400" />
              <div className="absolute inset-0 bg-violet-500/10 blur-xl rounded-full" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest text-violet-300">Executing Transaction</p>
            <p className="text-xs text-white/30">Writing to Private Ledger...</p>
          </div>
        )}

        {status === 'success' && lastTransaction && (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-10">
            <div className="relative p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
              <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-full" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight text-emerald-300">Confirmed</h3>
            <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06] font-mono text-sm w-full text-left space-y-1">
              <p className="text-white/60">Credited <span className="text-emerald-400 font-black">{lastTransaction.amount} {lastTransaction.asset}</span></p>
              <p className="text-white/40 text-xs">{lastTransaction.recipientEmail}</p>
            </div>
            <button className="btn-premium rounded-2xl px-8 h-12 font-black uppercase tracking-widest text-sm text-white mt-2" onClick={() => setStatus('idle')}>
              Done
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <XCircle className="h-10 w-10 text-red-400" />
            </div>
            <h3 className="text-base font-bold uppercase tracking-tight text-red-300">Transaction Rejected</h3>
            <p className="text-xs text-white/30 max-w-xs">Check whale treasury balance or Firestore permissions.</p>
            <Button variant="outline" className="rounded-2xl mt-2 px-8 border-white/10" onClick={() => setStatus('idle')}>Review Details</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FundWalletPage() {
  return (
    <AdminRoute>
      <div className="space-y-6 pb-20">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Wallet className="h-5 w-5 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Fund Wallet</h1>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">
            Internal Ledger Credit · Debits Whale Treasury
          </p>
        </div>
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-400" /></div>}>
          <FundWalletForm />
        </Suspense>
      </div>
    </AdminRoute>
  );
}
