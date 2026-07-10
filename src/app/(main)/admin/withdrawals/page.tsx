'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import { 
  collection, 
  getDocs,
  doc, 
  updateDoc, 
  serverTimestamp,
  runTransaction,
  addDoc,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Search,
  AlertTriangle,
  Building2,
  Globe,
  User,
  Wallet,
  RefreshCw,
  Eye,
  DollarSign,
  ArrowDownRight,
} from 'lucide-react';
import type { WithdrawalRequest, WithdrawalStatus } from '@/lib/types';

interface WithdrawalDoc extends WithdrawalRequest {
  cryptoBreakdown?: { symbol: string; amount: number; priceUSD: number }[];
  netFiatAmount?: number;
  carfReference?: string;
}

export default function WithdrawalApprovalsPage() {
  const { user } = useWallet();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [withdrawals, setWithdrawals] = useState<WithdrawalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalDoc | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const fetchWithdrawals = useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(firestore, 'withdrawal_requests'));
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as WithdrawalDoc));
      setWithdrawals(data);
    } catch (err: any) {
      console.error('[Withdrawals] Fetch error:', err);
      setError(err.message || 'Failed to pull payouts.');
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const { pendingWithdrawals, approvedWithdrawals, rejectedWithdrawals } = useMemo(() => {
    const p: WithdrawalDoc[] = [];
    const a: WithdrawalDoc[] = [];
    const r: WithdrawalDoc[] = [];
    
    withdrawals.forEach(w => {
      if (w.status === 'PENDING') p.push(w);
      else if (['APPROVED', 'PROCESSING', 'COMPLETED'].includes(w.status)) a.push(w);
      else r.push(w);
    });

    const sortFn = (x: WithdrawalDoc, y: WithdrawalDoc) => {
      const t1 = x.createdAt?.toMillis?.() ?? (x.createdAt?.seconds * 1000) ?? 0;
      const t2 = y.createdAt?.toMillis?.() ?? (y.createdAt?.seconds * 1000) ?? 0;
      return t2 - t1;
    };

    return {
      pendingWithdrawals: p.sort(sortFn),
      approvedWithdrawals: a.sort(sortFn),
      rejectedWithdrawals: r.sort(sortFn),
    };
  }, [withdrawals]);

  const handleApprove = useCallback(async (withdrawal: WithdrawalDoc) => {
    if (!firestore || !user) return;
    setIsProcessing(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const processedReqRef = doc(firestore, 'processed_requests', withdrawal.id);
            const processedReqSnap = await transaction.get(processedReqRef);

            if (processedReqSnap.exists()) {
                throw new Error('Request already processed.');
            }

            const withdrawalRef = doc(firestore, 'withdrawal_requests', withdrawal.id);
            const withdrawalSnap = await transaction.get(withdrawalRef);

            if (!withdrawalSnap.exists() || withdrawalSnap.data().status !== 'PENDING') {
                throw new Error('Already processed.');
            }

            if (withdrawal.cryptoBreakdown) {
                for (const crypto of withdrawal.cryptoBreakdown) {
                    const walletRef = doc(firestore, 'users', withdrawal.userId, 'wallets', crypto.symbol);
                    const walletSnap = await transaction.get(walletRef);
                    if (!walletSnap.exists()) continue;

                    const currentReserved = walletSnap.data().reservedForWithdrawal || 0;
                    transaction.update(walletRef, { reservedForWithdrawal: currentReserved - crypto.amount });

                    const txRef = doc(collection(firestore, 'users', withdrawal.userId, 'transactions'));
                    transaction.set(txRef, {
                        userId: withdrawal.userId,
                        type: 'Withdrawal',
                        amount: crypto.amount,
                        price: crypto.priceUSD,
                        currency: crypto.symbol,
                        timestamp: serverTimestamp(),
                        status: 'Completed',
                        referenceNo: withdrawal.transactionReference ?? '',
                    });
                }
            }

            transaction.update(withdrawalRef, {
                status: 'APPROVED',
                processedAt: serverTimestamp(),
                processedBy: user.uid,
                updatedAt: serverTimestamp(),
            });

            transaction.set(processedReqRef, { 
                requestId: withdrawal.id,
                processedAt: serverTimestamp(),
            });
        });

        toast({ title: 'Success', description: 'Payout approved.' });
        setIsDetailOpen(false);
        fetchWithdrawals();
    } catch (error: any) {
        toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
}, [firestore, user, toast, fetchWithdrawals]);

  const handleReject = useCallback(async (withdrawal: WithdrawalDoc) => {
    if (!firestore || !user || !rejectionReason.trim()) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'withdrawal_requests', withdrawal.id), {
        status: 'REJECTED',
        processedAt: serverTimestamp(),
        processedBy: user.uid,
        rejectionReason: rejectionReason.trim(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Rejected', description: 'Payout declined.' });
      setIsDetailOpen(false);
      fetchWithdrawals();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }, [firestore, user, rejectionReason, toast, fetchWithdrawals]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: WithdrawalStatus) => {
    const configs: Record<WithdrawalStatus, { className: string; icon: any }> = {
      PENDING: { className: 'bg-amber-500/20 text-amber-500 border-amber-500/30', icon: Clock },
      APPROVED: { className: 'bg-green-500/20 text-green-500 border-green-500/30', icon: CheckCircle2 },
      REJECTED: { className: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle },
      PROCESSING: { className: 'bg-blue-500/20 text-blue-500 border-blue-500/30', icon: RefreshCw },
      COMPLETED: { className: 'bg-accent/20 text-accent border-accent/30', icon: CheckCircle2 },
      FAILED: { className: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle },
      CANCELLED: { className: 'bg-muted/20 text-muted-foreground border-muted/30', icon: XCircle },
    };
    const config = configs[status] || configs.PENDING;
    const Icon = config.icon;
    return <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', config.className)}><Icon className="h-3 w-3 mr-1" />{status}</Badge>;
  };

  const filterList = (list: WithdrawalDoc[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(w => (w.userEmail || '').toLowerCase().includes(q) || (w.transactionReference || '').toLowerCase().includes(q));
  };

  const currentList = useMemo(() => {
    if (activeTab === 'pending') return filterList(pendingWithdrawals);
    if (activeTab === 'approved') return filterList(approvedWithdrawals);
    return filterList(rejectedWithdrawals);
  }, [activeTab, pendingWithdrawals, approvedWithdrawals, rejectedWithdrawals, searchQuery]);

  const WithdrawalCard = ({ withdrawal }: { withdrawal: WithdrawalDoc }) => (
    <div
      className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 hover:border-violet-500/15 transition-all cursor-pointer p-4 group"
      onClick={() => { setSelectedWithdrawal(withdrawal); setIsDetailOpen(true); }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            {withdrawal.withdrawalMethod === 'EFT' ? <Building2 className="h-5 w-5 text-violet-400" /> : <Globe className="h-5 w-5 text-violet-400" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/80 truncate">{withdrawal.accountHolder}</p>
            <p className="text-xs text-white/35 truncate">{withdrawal.userEmail}</p>
            <p className="text-[10px] text-white/20 font-mono mt-0.5">{withdrawal.transactionReference}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-white/80 tabular-nums">{formatCurrency(withdrawal.fiatAmount, withdrawal.fiatCurrency)}</p>
          <div className="mt-1">{getStatusBadge(withdrawal.status)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <ArrowDownRight className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Withdrawal Approvals</h1>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">Payout Review · FICA Compliance</p>
        </div>
        <button onClick={fetchWithdrawals} disabled={isLoading}
          className="h-9 px-4 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/40 hover:text-white/70 text-[11px] font-semibold flex items-center gap-2 transition-all disabled:opacity-40">
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} /> Refresh
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/[0.04] rounded-2xl p-1 h-11 border border-white/[0.06]">
          <TabsTrigger value="pending" className="rounded-xl text-[10px] font-semibold data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/25">
            Pending ({pendingWithdrawals.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="rounded-xl text-[10px] font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 data-[state=active]:border data-[state=active]:border-emerald-500/25">
            Settled ({approvedWithdrawals.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-xl text-[10px] font-semibold data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300 data-[state=active]:border data-[state=active]:border-red-500/25">
            Rejected ({rejectedWithdrawals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-5">
          {isLoading
            ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>
            : currentList.length > 0
              ? <div className="grid gap-3">{currentList.map(w => <WithdrawalCard key={w.id} withdrawal={w} />)}</div>
              : <div className="py-20 text-center text-white/15 font-semibold uppercase tracking-widest text-sm">No Entries</div>}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/60">
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px] bg-gradient-to-r from-emerald-500 to-violet-500" />
          <DialogHeader>
            <DialogTitle className="text-white font-bold">Payout Details</DialogTitle>
            <DialogDescription className="text-white/30">Review and settle this withdrawal request.</DialogDescription>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2.5 text-sm font-medium">
                {[
                  { label: 'Beneficiary', value: selectedWithdrawal.accountHolder },
                  { label: 'Bank', value: selectedWithdrawal.bankName },
                  { label: 'Account', value: selectedWithdrawal.accountNumber },
                  { label: 'Amount', value: formatCurrency(selectedWithdrawal.fiatAmount, selectedWithdrawal.fiatCurrency), highlight: true },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center text-xs border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
                    <span className="text-white/30 font-semibold uppercase text-[9px] tracking-widest">{row.label}</span>
                    <span className={row.highlight ? 'text-emerald-400 font-bold' : 'text-white/60'}>{row.value}</span>
                  </div>
                ))}
              </div>
              {selectedWithdrawal.status === 'PENDING' && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Rejection reason (required to reject)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="bg-white/[0.04] border-white/[0.07] rounded-xl text-sm"
                  />
                  <DialogFooter className="gap-2">
                    <Button variant="outline" className="rounded-xl border-red-500/25 text-red-400 hover:bg-red-500/10" onClick={() => handleReject(selectedWithdrawal)} disabled={isProcessing || !rejectionReason.trim()}>
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                    </Button>
                    <button className="btn-premium rounded-xl px-5 h-10 font-bold text-sm text-white flex items-center gap-2 disabled:opacity-40" onClick={() => handleApprove(selectedWithdrawal)} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve Payout'}
                    </button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
