'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import {
  collection, getDocs, doc, updateDoc, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, XCircle, Clock, Loader2, Search, User, FileText,
  Shield, Calendar, Eye, UserCheck, Banknote, AlertTriangle, RefreshCw,
} from 'lucide-react';
import type { KYCSubmission, KYCStatus } from '@/lib/types';
import { COUNTRIES } from '@/lib/countries';

export default function KYCApprovalsPage() {
  const { user } = useWallet();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const fetchSubmissions = useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(firestore, 'kyc_submissions'));
      const data = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as KYCSubmission[];
      setSubmissions(data);
    } catch (err: any) {
      console.error('[KYC] Fetch error:', err);
      setError(err.message || 'Failed to connect to registry.');
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Client-side filtering and sorting
  const { pendingSubmissions, approvedSubmissions, rejectedSubmissions } = useMemo(() => {
    const p: KYCSubmission[] = [];
    const a: KYCSubmission[] = [];
    const r: KYCSubmission[] = [];

    submissions.forEach(s => {
      if (s.status === 'APPROVED') a.push(s);
      else if (s.status === 'REJECTED') r.push(s);
      else p.push(s);
    });

    const sortFn = (x: KYCSubmission, y: KYCSubmission) => {
      const t1 = x.submittedAt?.toMillis?.() ?? (x.submittedAt?.seconds * 1000) ?? 0;
      const t2 = y.submittedAt?.toMillis?.() ?? (y.submittedAt?.seconds * 1000) ?? 0;
      return t2 - t1;
    };

    return {
      pendingSubmissions: p.sort(sortFn),
      approvedSubmissions: a.sort(sortFn),
      rejectedSubmissions: r.sort(sortFn),
    };
  }, [submissions]);

  const handleApprove = useCallback(async (submission: KYCSubmission) => {
    if (!firestore || !user) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'kyc_submissions', submission.id), {
        status: 'APPROVED', 
        reviewedAt: serverTimestamp(), 
        reviewedBy: user.uid,
      });
      await updateDoc(doc(firestore, 'users', submission.userId), {
        kycStatus: 'APPROVED', 
        kycApprovedAt: serverTimestamp(),
      });
      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'SYSTEM_ALERT', 
        title: 'Identity Verified',
        message: `Your identity has been successfully verified. You can now proceed with withdrawals.`,
        userId: submission.userId, 
        userEmail: submission.userEmail, 
        referenceId: submission.id,
        read: false, 
        createdAt: serverTimestamp(),
      });
      toast({ title: 'KYC Approved', description: `Successfully approved KYC for ${submission.fullName}.` });
      setIsDetailOpen(false); 
      setSelectedSubmission(null);
      fetchSubmissions();
    } catch (error) {
      console.error('Error approving KYC:', error);
      toast({ title: 'Approval Failed', description: 'Failed to approve KYC submission.', variant: 'destructive' });
    } finally { 
      setIsProcessing(false); 
    }
  }, [firestore, user, toast, fetchSubmissions]);

  const handleReject = useCallback(async (submission: KYCSubmission) => {
    if (!firestore || !user || !rejectionReason.trim()) {
      toast({ title: 'Rejection Reason Required', description: 'Please provide a reason for rejection.', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'kyc_submissions', submission.id), {
        status: 'REJECTED', 
        reviewedAt: serverTimestamp(), 
        reviewedBy: user.uid,
        rejectionReason: rejectionReason.trim(),
      });
      await updateDoc(doc(firestore, 'users', submission.userId), { kycStatus: 'REJECTED' });
      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'SYSTEM_ALERT', 
        title: 'Verification Not Approved',
        message: `Your identity verification was not approved. Reason: ${rejectionReason.trim()}. Please submit new documents.`,
        userId: submission.userId, 
        userEmail: submission.userEmail, 
        referenceId: submission.id,
        read: false, 
        createdAt: serverTimestamp(),
      });
      toast({ title: 'KYC Rejected', description: `KYC for ${submission.fullName} has been rejected.` });
      setIsDetailOpen(false); 
      setSelectedSubmission(null); 
      setRejectionReason('');
      fetchSubmissions();
    } catch (error) {
      console.error('Error rejecting KYC:', error);
      toast({ title: 'Rejection Failed', description: 'Failed to reject KYC submission.', variant: 'destructive' });
    } finally { 
      setIsProcessing(false); 
    }
  }, [firestore, user, rejectionReason, toast, fetchSubmissions]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: KYCStatus) => {
    const configs: Record<KYCStatus, { className: string; icon: any }> = {
      NOT_SUBMITTED: { className: 'bg-muted text-muted-foreground', icon: FileText },
      PENDING: { className: 'bg-amber-500/20 text-amber-500 border-amber-500/30', icon: Clock },
      APPROVED: { className: 'bg-green-500/20 text-green-500 border-green-500/30', icon: CheckCircle2 },
      REJECTED: { className: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle },
    };
    const config = configs[status] || configs.NOT_SUBMITTED;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', config.className)}>
        <Icon className="h-3 w-3 mr-1" /> {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getDocumentTypeLabel = (type: string, countryCode?: string) => {
    const labels: Record<string, string> = { passport: 'Passport', drivers_license: "Driver's License", national_id: 'National ID' };
    if (countryCode === 'ZA' && type === 'national_id') return 'SA National ID';
    return labels[type] || type;
  };

  const getCountryFlag = (code?: string) => COUNTRIES.find(c => c.code === code)?.flag || '';

  const filterList = (subs: KYCSubmission[]) => {
    if (!searchQuery.trim()) return subs;
    const q = searchQuery.toLowerCase();
    return subs.filter(s =>
      (s.userEmail || '').toLowerCase().includes(q) ||
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.documentNumber || '').toLowerCase().includes(q)
    );
  };

  const currentList = useMemo(() => {
    if (activeTab === 'pending') return filterList(pendingSubmissions);
    if (activeTab === 'approved') return filterList(approvedSubmissions);
    return filterList(rejectedSubmissions);
  }, [activeTab, pendingSubmissions, approvedSubmissions, rejectedSubmissions, searchQuery]);

  const SubmissionCard = ({ submission }: { submission: KYCSubmission }) => (
    <div
      className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 hover:border-violet-500/15 transition-all cursor-pointer p-4 group"
      onClick={() => { setSelectedSubmission(submission); setIsDetailOpen(true); }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/80 truncate">{submission.fullName}</p>
            <p className="text-xs text-white/35 truncate">{submission.userEmail}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-lg bg-white/[0.04] text-white/30 border border-white/[0.06]">
                {getDocumentTypeLabel(submission.documentType, submission.countryCode)}
              </span>
              <span className="text-[10px] text-white/25">{getCountryFlag(submission.countryCode)} {submission.nationality}</span>
            </div>
          </div>
        </div>
        <div className="shrink-0">{getStatusBadge(submission.status)}</div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] text-white/25">
          <Clock className="h-3 w-3" /> {formatDate(submission.submittedAt)}
        </div>
        <div className="flex items-center gap-2">
          {submission.withdrawalIntent && (
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <Banknote className="h-2.5 w-2.5" />
              Blocking {submission.withdrawalIntent.method}
            </span>
          )}
          <span className="text-[10px] font-semibold text-violet-400/60 group-hover:text-violet-400 flex items-center gap-1 transition-colors">
            <Eye className="h-3 w-3" /> Review
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <UserCheck className="h-5 w-5 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">KYC Verification</h1>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">Identity Document Review · Compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSubmissions} disabled={isLoading} className="gap-2 h-9 rounded-xl border-white/10 bg-white/5">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-primary")} />
            Refresh
          </Button>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" /> {pendingSubmissions.length} Pending
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email..." className="pl-10 bg-background/50"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/[0.04] rounded-2xl p-1 h-11 border border-white/[0.06]">
          <TabsTrigger value="pending" className="rounded-xl text-[10px] font-semibold data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/25">
            Pending ({pendingSubmissions.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="rounded-xl text-[10px] font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 data-[state=active]:border data-[state=active]:border-emerald-500/25">
            Approved ({approvedSubmissions.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-xl text-[10px] font-semibold data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300 data-[state=active]:border data-[state=active]:border-red-500/25">
            Rejected ({rejectedSubmissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-5">
          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 py-10 text-center space-y-3">
              <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
              <h3 className="font-bold text-red-300">Connection Error</h3>
              <p className="text-sm text-white/30 max-w-md mx-auto">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchSubmissions} className="border-white/10">Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
              <p className="text-xs text-white/25 animate-pulse font-semibold">Loading Submissions...</p>
            </div>
          ) : currentList.length > 0 ? (
            <div className="grid gap-3">
              {currentList.map((submission) => <SubmissionCard key={submission.id} submission={submission} />)}
            </div>
          ) : (
            <div className="py-20 text-center">
              <UserCheck className="h-10 w-10 mx-auto mb-4 text-white/[0.08]" />
              <p className="text-sm font-semibold text-white/20 uppercase tracking-widest">No {activeTab} Submissions</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> KYC Review</DialogTitle>
            <DialogDescription>Review the identity verification submission details.</DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(selectedSubmission.status)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selectedSubmission.documentImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-border/30">
                    <img src={selectedSubmission.documentImageUrl} alt="Document" className="w-full h-48 object-cover" />
                    <p className="text-[10px] text-center text-muted-foreground p-1 bg-muted/20">Document Photo</p>
                  </div>
                )}
                {selectedSubmission.selfieImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-border/30">
                    <img src={selectedSubmission.selfieImageUrl} alt="Selfie" className="w-full h-48 object-cover" />
                    <p className="text-[10px] text-center text-muted-foreground p-1 bg-muted/20">Selfie</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Full Name</span><p className="font-semibold">{selectedSubmission.fullName}</p></div>
                  <div><span className="text-muted-foreground">Email</span><p className="font-semibold truncate">{selectedSubmission.userEmail}</p></div>
                  <div><span className="text-muted-foreground">Date of Birth</span><p className="font-semibold flex items-center gap-1"><Calendar className="h-3 w-3" /> {selectedSubmission.dateOfBirth}</p></div>
                  <div><span className="text-muted-foreground">Country</span><p className="font-semibold flex items-center gap-1">{getCountryFlag(selectedSubmission.countryCode)} {selectedSubmission.nationality}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Address</span><p className="font-semibold">{selectedSubmission.address}</p></div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity Document</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Type</span><p className="font-semibold flex items-center gap-1"><FileText className="h-3 w-3" /> {getDocumentTypeLabel(selectedSubmission.documentType, selectedSubmission.countryCode)}</p></div>
                  <div><span className="text-muted-foreground">Number</span><p className="font-mono font-semibold">{selectedSubmission.documentNumber}</p></div>
                  <div><span className="text-muted-foreground">Expiry</span><p className="font-semibold">{selectedSubmission.documentExpiry}</p></div>
                </div>
              </div>

              {selectedSubmission.withdrawalIntent && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="h-4 w-4 text-amber-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-400">Blocked Withdrawal Intent</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-1 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs block">Amount</span>
                      <p className="font-semibold">{selectedSubmission.withdrawalIntent.currency} {parseFloat(selectedSubmission.withdrawalIntent.amount).toLocaleString()}</p>
                    </div>
                    <div><span className="text-muted-foreground text-xs block">Method</span><p className="font-semibold">{selectedSubmission.withdrawalIntent.method}</p></div>
                  </div>
                </div>
              )}

              {selectedSubmission.status === 'PENDING' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Rejection Reason (if rejecting)</label>
                    <Textarea placeholder="e.g., Document expired..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="bg-background/50" />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="destructive" onClick={() => handleReject(selectedSubmission)} disabled={isProcessing} className="flex-1">
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />} Reject
                    </Button>
                    <Button onClick={() => handleApprove(selectedSubmission)} disabled={isProcessing} className="flex-1 bg-accent text-accent-foreground">
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Approve
                    </Button>
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
