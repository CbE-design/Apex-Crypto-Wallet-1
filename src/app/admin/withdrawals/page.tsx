'use client';

import { useState, useCallback } from 'react';
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
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
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

  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalDoc | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Fetch withdrawal requests
  const withdrawalsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'withdrawal_requests');
  }, [firestore]);

  const pendingQuery = useMemoFirebase(() => {
    if (!withdrawalsRef) return null;
    return query(withdrawalsRef, where('status', '==', 'PENDING'));
  }, [withdrawalsRef]);

  const approvedQuery = useMemoFirebase(() => {
    if (!withdrawalsRef) return null;
    return query(withdrawalsRef, where('status', 'in', ['APPROVED', 'PROCESSING', 'COMPLETED']));
  }, [withdrawalsRef]);

  const rejectedQuery = useMemoFirebase(() => {
    if (!withdrawalsRef) return null;
    return query(withdrawalsRef, where('status', '==', 'REJECTED'));
  }, [withdrawalsRef]);

  const sortByDate = (items: WithdrawalDoc[] | null) =>
    items ? [...items].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)) : null;

  const { data: rawPending, isLoading: loadingPending } = useCollection<WithdrawalDoc>(pendingQuery);
  const { data: rawApproved, isLoading: loadingApproved } = useCollection<WithdrawalDoc>(approvedQuery);
  const { data: rawRejected, isLoading: loadingRejected } = useCollection<WithdrawalDoc>(rejectedQuery);

  const pendingWithdrawals = sortByDate(rawPending);
  const approvedWithdrawals = sortByDate(rawApproved);
  const rejectedWithdrawals = sortByDate(rawRejected);

  const handleApprove = useCallback(async (withdrawal: WithdrawalDoc | null) => {
    if (!firestore || !user || !withdrawal) {
      console.log('[v0] handleApprove: missing firestore, user, or withdrawal');
      return;
    }
    
    setIsProcessing(true);
    try {
      console.log('[v0] Starting approval for withdrawal:', withdrawal.id);
      
      // Use transaction to update withdrawal and deduct from user's wallet
      await runTransaction(firestore, async (transaction) => {
        const withdrawalRef = doc(firestore, 'withdrawal_requests', withdrawal.id);
        console.log('[v0] Updating withdrawal ref:', withdrawalRef.path);
        
        // Update withdrawal status
        transaction.update(withdrawalRef, {
          status: 'APPROVED',
          processedAt: serverTimestamp(),
          processedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        console.log('[v0] Withdrawal status updated to APPROVED');

        // Deduct crypto from user's wallets
        if (withdrawal.cryptoBreakdown) {
          console.log('[v0] Processing crypto breakdown:', withdrawal.cryptoBreakdown);
          for (const crypto of withdrawal.cryptoBreakdown) {
            const walletRef = doc(firestore, 'users', withdrawal.userId, 'wallets', crypto.symbol);
            const walletSnap = await transaction.get(walletRef);
            
            if (walletSnap.exists()) {
              const currentBalance = walletSnap.data().balance || 0;
              const newBalance = Math.max(0, currentBalance - crypto.amount);
              transaction.update(walletRef, { balance: newBalance });
              console.log(`[v0] Updated ${crypto.symbol} balance: ${currentBalance} -> ${newBalance}`);
            } else {
              console.log(`[v0] Wallet not found for ${crypto.symbol}`);
            }
          }

          // Create a single consolidated transaction record in the user's transactions collection
          // This is where TransactionHistory reads from
          const userTxRef = doc(collection(firestore, 'users', withdrawal.userId, 'transactions'));
          const primaryCrypto = withdrawal.cryptoBreakdown[0];
          const totalCryptoAmount = withdrawal.cryptoBreakdown.reduce((sum, c) => sum + c.amount, 0);
          
          transaction.set(userTxRef, {
            userId: withdrawal.userId,
            type: 'Withdrawal',
            currency: primaryCrypto.symbol,
            amount: totalCryptoAmount,
            price: primaryCrypto.priceUSD,
            timestamp: serverTimestamp(),
            status: 'Completed',
            referenceNo: withdrawal.transactionReference,
            method: withdrawal.withdrawalMethod,
            beneficiaryName: withdrawal.accountHolder,
            fiatAmount: withdrawal.fiatAmount,
            fiatCurrency: withdrawal.fiatCurrency,
            notes: `Approved withdrawal - Ref: ${withdrawal.transactionReference}`,
          });
        }
      });

      // Create notification for user
      console.log('[v0] Creating user notification for withdrawal approval');
      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'SYSTEM_ALERT',
        title: 'Withdrawal Approved',
        message: `Withdrawal request ${withdrawal.transactionReference} has been approved and is being processed.`,
        userId: withdrawal.userId,
        userEmail: withdrawal.userEmail,
        referenceId: withdrawal.transactionReference,
        read: false,
        createdAt: serverTimestamp(),
      });

      console.log('[v0] Approval completed successfully');
      toast({
        title: 'Withdrawal Approved',
        description: `Successfully approved withdrawal ${withdrawal.transactionReference}. User's balance has been updated.`,
      });
      
      console.log('[v0] Closing dialog and resetting state');
      setIsDetailOpen(false);
      setSelectedWithdrawal(null);
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      toast({
        title: 'Approval Failed',
        description: 'Failed to approve withdrawal. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [firestore, user, toast]);

  const handleReject = useCallback(async (withdrawal: WithdrawalDoc) => {
    if (!firestore || !user || !rejectionReason.trim()) {
      toast({
        title: 'Rejection Reason Required',
        description: 'Please provide a reason for rejection.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);
    try {
      const withdrawalRef = doc(firestore, 'withdrawal_requests', withdrawal.id);
      
      await updateDoc(withdrawalRef, {
        status: 'REJECTED',
        processedAt: serverTimestamp(),
        processedBy: user.uid,
        rejectionReason: rejectionReason.trim(),
        updatedAt: serverTimestamp(),
      });

      // Create notification for user
      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'SYSTEM_ALERT',
        title: 'Withdrawal Rejected',
        message: `Withdrawal request ${withdrawal.transactionReference} was rejected. Reason: ${rejectionReason.trim()}`,
        userId: withdrawal.userId,
        userEmail: withdrawal.userEmail,
        referenceId: withdrawal.transactionReference,
        read: false,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Withdrawal Rejected',
        description: `Withdrawal ${withdrawal.transactionReference} has been rejected.`,
      });
      
      setIsDetailOpen(false);
      setSelectedWithdrawal(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      toast({
        title: 'Rejection Failed',
        description: 'Failed to reject withdrawal. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [firestore, user, rejectionReason, toast]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: WithdrawalStatus) => {
    const configs: Record<WithdrawalStatus, { className: string; icon: typeof CheckCircle2 }> = {
      PENDING: { className: 'bg-amber-500/20 text-amber-500 border-amber-500/30', icon: Clock },
      APPROVED: { className: 'bg-green-500/20 text-green-500 border-green-500/30', icon: CheckCircle2 },
      REJECTED: { className: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle },
      PROCESSING: { className: 'bg-blue-500/20 text-blue-500 border-blue-500/30', icon: RefreshCw },
      COMPLETED: { className: 'bg-accent/20 text-accent border-accent/30', icon: CheckCircle2 },
      FAILED: { className: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle },
    };
    const config = configs[status];
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', config.className)}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const filterWithdrawals = (withdrawals: WithdrawalDoc[] | null) => {
    if (!withdrawals || !searchQuery.trim()) return withdrawals;
    const query = searchQuery.toLowerCase();
    return withdrawals.filter(w => 
      w.userEmail?.toLowerCase().includes(query) ||
      w.transactionReference?.toLowerCase().includes(query) ||
      w.accountHolder?.toLowerCase().includes(query)
    );
  };

  const WithdrawalCard = ({ withdrawal }: { withdrawal: WithdrawalDoc }) => (
    <Card 
      className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer"
      onClick={() => {
        setSelectedWithdrawal(withdrawal);
        setIsDetailOpen(true);
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              {withdrawal.withdrawalMethod === 'EFT' ? (
                <Building2 className="h-5 w-5 text-primary" />
              ) : (
                <Globe className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{withdrawal.accountHolder}</p>
              <p className="text-xs text-muted-foreground truncate">{withdrawal.userEmail}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-1">{withdrawal.transactionReference}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold">{formatCurrency(withdrawal.fiatAmount, withdrawal.fiatCurrency)}</p>
            <p className="text-xs text-muted-foreground">{withdrawal.withdrawalMethod}</p>
            {getStatusBadge(withdrawal.status)}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(withdrawal.createdAt)}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => {
              console.log('[v0] Opening withdrawal details for:', withdrawal.id);
              setSelectedWithdrawal(withdrawal);
              setIsDetailOpen(true);
            }}
          >
            <Eye className="h-3 w-3 mr-1" /> View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const currentWithdrawals = activeTab === 'pending' 
    ? filterWithdrawals(pendingWithdrawals) 
    : activeTab === 'approved' 
    ? filterWithdrawals(approvedWithdrawals) 
    : filterWithdrawals(rejectedWithdrawals);

  const isLoading = activeTab === 'pending' ? loadingPending : activeTab === 'approved' ? loadingApproved : loadingRejected;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Withdrawal Approvals</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">
            Review & Approve Pending Withdrawals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" />
            {pendingWithdrawals?.length || 0} Pending
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, reference, or name..."
            className="pl-10 bg-background/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 rounded-2xl p-1 h-12">
          <TabsTrigger value="pending" className="rounded-xl font-bold text-xs gap-2">
            <Clock className="h-3 w-3" /> Pending ({pendingWithdrawals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="approved" className="rounded-xl font-bold text-xs gap-2">
            <CheckCircle2 className="h-3 w-3" /> Approved ({approvedWithdrawals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-xl font-bold text-xs gap-2">
            <XCircle className="h-3 w-3" /> Rejected ({rejectedWithdrawals?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : currentWithdrawals && currentWithdrawals.length > 0 ? (
            <div className="grid gap-4">
              {currentWithdrawals.map((withdrawal) => (
                <WithdrawalCard key={withdrawal.id} withdrawal={withdrawal} />
              ))}
            </div>
          ) : (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <ArrowDownRight className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No {activeTab} Withdrawals</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'pending' 
                    ? 'All withdrawal requests have been processed.' 
                    : `No ${activeTab} withdrawal requests found.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Withdrawal Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Withdrawal Request Details
            </DialogTitle>
            <DialogDescription>
              Review the withdrawal request and take action.
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reference</span>
                <span className="font-mono text-sm font-semibold">{selectedWithdrawal.transactionReference}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(selectedWithdrawal.status)}
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User Information</h4>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedWithdrawal.accountHolder}</p>
                    <p className="text-xs text-muted-foreground">{selectedWithdrawal.userEmail}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Withdrawal Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Amount</span>
                    <p className="font-semibold">{formatCurrency(selectedWithdrawal.fiatAmount, selectedWithdrawal.fiatCurrency)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Net Amount</span>
                    <p className="font-semibold text-accent">
                      {formatCurrency(selectedWithdrawal.netFiatAmount || selectedWithdrawal.fiatAmount - selectedWithdrawal.networkFee, selectedWithdrawal.fiatCurrency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Method</span>
                    <p className="font-semibold">{selectedWithdrawal.withdrawalMethod}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bank</span>
                    <p className="font-semibold">{selectedWithdrawal.bankName}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Account Number</span>
                    <p className="font-mono font-semibold">{selectedWithdrawal.accountNumber}</p>
                  </div>
                </div>
              </div>

              {selectedWithdrawal.cryptoBreakdown && selectedWithdrawal.cryptoBreakdown.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Crypto to Deduct</h4>
                  <div className="space-y-2">
                    {selectedWithdrawal.cryptoBreakdown.map((crypto, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <span>{crypto.symbol}</span>
                        </div>
                        <span className="font-mono font-semibold">
                          {(crypto.amount ?? 0).toFixed(crypto.symbol === 'BTC' ? 8 : 6)} {crypto.symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Submitted: {formatDate(selectedWithdrawal.createdAt)}
              </div>

              {selectedWithdrawal.status === 'PENDING' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Rejection Reason (if rejecting)</label>
                    <Textarea
                      placeholder="Provide a reason for rejection..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedWithdrawal)}
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        console.log('[v0] Approve button clicked, selectedWithdrawal:', selectedWithdrawal?.id);
                        if (!selectedWithdrawal) {
                          console.log('[v0] ERROR: No withdrawal selected');
                          toast({
                            title: 'Error',
                            description: 'No withdrawal selected',
                            variant: 'destructive',
                          });
                          return;
                        }
                        handleApprove(selectedWithdrawal);
                      }}
                      disabled={isProcessing}
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve & Process
                    </Button>
                  </DialogFooter>
                </>
              )}

              {selectedWithdrawal.status === 'REJECTED' && selectedWithdrawal.rejectionReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">Rejection Reason</h4>
                  <p className="text-sm text-muted-foreground">{selectedWithdrawal.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
