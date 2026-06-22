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

                    const currentBalance = walletSnap.data().balance || 0;
                    transaction.update(walletRef, { balance: currentBalance - crypto.amount });

                    const txRef = doc(collection(walletRef, 'transactions'));
                    transaction.set(txRef, {
                        userId: withdrawal.userId,
                        type: 'Withdrawal',
                        amount: crypto.amount,
                        price: crypto.priceUSD,
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
    <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer" onClick={() => { setSelectedWithdrawal(withdrawal); setIsDetailOpen(true); }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              {withdrawal.withdrawalMethod === 'EFT' ? <Building2 className="h-5 w-5 text-primary" /> : <Globe className="h-5 w-5 text-primary" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{withdrawal.accountHolder}</p>
              <p className="text-xs text-muted-foreground truncate">{withdrawal.userEmail}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-1">{withdrawal.transactionReference}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold">{formatCurrency(withdrawal.fiatAmount, withdrawal.fiatCurrency)}</p>
            {getStatusBadge(withdrawal.status)}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Withdrawal Approvals</h1>
        <Button variant="outline" size="sm" onClick={fetchWithdrawals} disabled={isLoading} className="gap-2 h-9 rounded-xl"><RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} /> Refresh</Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 rounded-2xl p-1 h-12">
          <TabsTrigger value="pending">Pending ({pendingWithdrawals.length})</TabsTrigger>
          <TabsTrigger value="approved">Settled ({approvedWithdrawals.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejectedWithdrawals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : currentList.length > 0 ? <div className="grid gap-4">{currentList.map(w => <WithdrawalCard key={w.id} withdrawal={w} />)}</div> : <div className="py-20 text-center font-bold text-muted-foreground uppercase opacity-20">No Entries Detected</div>}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payout Details</DialogTitle>
            <DialogDescription>Review and settle this withdrawal.</DialogDescription>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
               <div className="rounded-xl bg-white/5 p-4 space-y-2 text-sm font-medium">
                  <p><strong>Beneficiary:</strong> {selectedWithdrawal.accountHolder}</p>
                  <p><strong>Bank:</strong> {selectedWithdrawal.bankName}</p>
                  <p><strong>Account:</strong> {selectedWithdrawal.accountNumber}</p>
                  <p className="text-primary"><strong>Amount:</strong> {formatCurrency(selectedWithdrawal.fiatAmount, selectedWithdrawal.fiatCurrency)}</p>
               </div>
               {selectedWithdrawal.status === 'PENDING' && (
                 <>
                   <Textarea placeholder="Rejection reason..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                   <DialogFooter className="gap-2">
                     <Button variant="destructive" onClick={() => handleReject(selectedWithdrawal)} disabled={isProcessing}>Reject</Button>
                     <Button onClick={() => handleApprove(selectedWithdrawal)} disabled={isProcessing} className="bg-accent text-white">Approve Payout</Button>
                   </DialogFooter>
                 </>
               )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
