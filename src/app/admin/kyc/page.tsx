'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, updateDoc, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, XCircle, Clock, Loader2, Search, User, FileText,
  Shield, Calendar, MapPin, Eye, UserCheck, AlertTriangle,
  Banknote, Globe, ArrowRight, Scan, Bot, Fingerprint, Image,
} from 'lucide-react';
import type { KYCSubmission, KYCStatus } from '@/lib/types';
import { COUNTRIES } from '@/lib/countries';

export default function KYCApprovalsPage() {
  const { user } = useWallet();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const kycRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kyc_submissions');
  }, [firestore]);

  const pendingQuery = useMemoFirebase(() => {
    if (!kycRef) return null;
    return query(kycRef, where('status', '==', 'PENDING'));
  }, [kycRef]);

  const approvedQuery = useMemoFirebase(() => {
    if (!kycRef) return null;
    return query(kycRef, where('status', '==', 'APPROVED'));
  }, [kycRef]);

  const rejectedQuery = useMemoFirebase(() => {
    if (!kycRef) return null;
    return query(kycRef, where('status', '==', 'REJECTED'));
  }, [kycRef]);

  const { data: rawPending, isLoading: loadingPending } = useCollection<KYCSubmission>(pendingQuery);
  const { data: rawApproved, isLoading: loadingApproved } = useCollection<KYCSubmission>(approvedQuery);
  const { data: rawRejected, isLoading: loadingRejected } = useCollection<KYCSubmission>(rejectedQuery);

  const sortByDate = (items: KYCSubmission[] | null) =>
    items ? [...items].sort((a: KYCSubmission, b: KYCSubmission) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0)) : null;

  const pendingSubmissions = sortByDate(rawPending);
  const approvedSubmissions = sortByDate(rawApproved);
  const rejectedSubmissions = sortByDate(rawRejected);

  const handleApprove = useCallback(async (submission: KYCSubmission) => {
    if (!firestore || !user) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'kyc_submissions', submission.id), {
        status: 'APPROVED', reviewedAt: serverTimestamp(), reviewedBy: user.uid,
      });
      await updateDoc(doc(firestore, 'users', submission.userId), {
        kycStatus: 'APPROVED', kycApprovedAt: serverTimestamp(),
      });
      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'SYSTEM_ALERT', title: 'Identity Verified',
        message: `Your identity has been successfully verified. You can now proceed with withdrawals.`,
        userId: submission.userId, userEmail: submission.userEmail, referenceId: submission.id,
        read: false, createdAt: serverTimestamp(),
      });
      toast({ title: 'KYC Approved', description: `Successfully approved KYC for ${submission.fullName}.` });
      setIsDetailOpen(false); setSelectedSubmission(null);
    } catch (error) {
      console.error('Error approving KYC:', error);
      toast({ title: 'Approval Failed', description: 'Failed to approve KYC submission.', variant: 'destructive' });
    } finally { setIsProcessing(false); }
  }, [firestore, user, toast]);

  const handleReject = useCallback(async (submission: KYCSubmission) => {
    if (!firestore || !user || !rejectionReason.trim()) {
      toast({ title: 'Rejection Reason Required', description: 'Please provide a reason for rejection.', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'kyc_submissions', submission.id), {
        status: 'REJECTED', reviewedAt: serverTimestamp(), reviewedBy: user.uid,
        rejectionReason: rejectionReason.trim(),
      });
      await updateDoc(doc(firestore, 'users', submission.userId), { kycStatus: 'REJECTED' });
      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'SYSTEM_ALERT', title: 'Verification Not Approved',
        message: `Your identity verification was not approved. Reason: ${rejectionReason.trim()}. Please submit new documents.`,
        userId: submission.userId, userEmail: submission.userEmail, referenceId: submission.id,
        read: false, createdAt: serverTimestamp(),
      });
      toast({ title: 'KYC Rejected', description: `KYC for ${submission.fullName} has been rejected.` });
      setIsDetailOpen(false); setSelectedSubmission(null); setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting KYC:', error);
      toast({ title: 'Rejection Failed', description: 'Failed to reject KYC submission.', variant: 'destructive' });
    } finally { setIsProcessing(false); }
  }, [firestore, user, rejectionReason, toast]);

  const handleAutoVerify = useCallback(async (submission: KYCSubmission) => {
    if (!submission.documentImageUrl || !submission.selfieImageUrl) {
      toast({ title: 'Missing Images', description: 'This submission does not have uploaded photos for verification.', variant: 'destructive' });
      return;
    }
    setIsVerifying(true);
    try {
      let idToken: string | undefined;
      try {
        const { getAuth } = await import('firebase/auth');
        const currentUser = getAuth().currentUser;
        if (currentUser) idToken = await currentUser.getIdToken();
      } catch {
        // Could not get token
      }

      const res = await fetch('/api/admin/kyc/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          submissionId: submission.id,
          documentImageUrl: submission.documentImageUrl,
          selfieImageUrl: submission.selfieImageUrl,
          fullName: submission.fullName,
          dateOfBirth: submission.dateOfBirth,
          documentNumber: submission.documentNumber,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Auto-Verification Complete',
          description: `Confidence: ${Math.round(data.overallConfidence * 100)}% — ${data.recommendation}`,
        });
        // Refresh selected submission with updated data
        setSelectedSubmission({ ...submission, autoVerification: data });
      } else {
        toast({ title: 'Verification Failed', description: data.error || 'Could not run verification.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Verification Error', description: err.message || 'Network error.', variant: 'destructive' });
    } finally { setIsVerifying(false); }
  }, [toast]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: KYCStatus) => {
    const configs: Record<KYCStatus, { className: string; icon: typeof CheckCircle2 }> = {
      NOT_SUBMITTED: { className: 'bg-muted text-muted-foreground', icon: FileText },
      PENDING: { className: 'bg-amber-500/20 text-amber-500 border-amber-500/30', icon: Clock },
      APPROVED: { className: 'bg-green-500/20 text-green-500 border-green-500/30', icon: CheckCircle2 },
      REJECTED: { className: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle },
    };
    const config = configs[status];
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

  const filterSubmissions = (submissions: KYCSubmission[] | null) => {
    if (!submissions || !searchQuery.trim()) return submissions;
    const q = searchQuery.toLowerCase();
    return submissions.filter(s =>
      s.userEmail?.toLowerCase().includes(q) ||
      s.fullName?.toLowerCase().includes(q) ||
      s.documentNumber?.toLowerCase().includes(q)
    );
  };

  const SubmissionCard = ({ submission }: { submission: KYCSubmission }) => (
    <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer"
      onClick={() => { setSelectedSubmission(submission); setIsDetailOpen(true); }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{submission.fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{submission.userEmail}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[9px] bg-muted/30">
                  {getDocumentTypeLabel(submission.documentType, submission.countryCode)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{getCountryFlag(submission.countryCode)} {submission.nationality}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">{getStatusBadge(submission.status)}</div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {formatDate(submission.submittedAt)}
          </div>
          <div className="flex items-center gap-2">
            {submission.withdrawalIntent && (
              <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1">
                <Banknote className="h-2.5 w-2.5" />
                Blocking {submission.withdrawalIntent.method} {submission.withdrawalIntent.currency} {parseFloat(submission.withdrawalIntent.amount).toLocaleString()}
              </Badge>
            )}
            {submission.autoVerification && (
              <Badge variant="outline" className={cn('text-[9px] gap-1',
                submission.autoVerification.recommendation === 'AUTO_APPROVE' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                submission.autoVerification.recommendation === 'REJECT' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                'bg-amber-500/10 text-amber-400 border-amber-500/30'
              )}>
                <Bot className="h-2.5 w-2.5" />
                {submission.autoVerification.recommendation.replace('_', ' ')}
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs"><Eye className="h-3 w-3 mr-1" /> Review</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const VerificationResults = ({ result }: { result: NonNullable<KYCSubmission['autoVerification']> }) => (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Scan className="h-3.5 w-3.5" /> Auto-Verification Results
        </h4>
        <Badge variant="outline" className={cn('text-[10px] font-bold',
          result.recommendation === 'AUTO_APPROVE' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
          result.recommendation === 'REJECT' ? 'bg-destructive/10 text-destructive border-destructive/30' :
          'bg-amber-500/10 text-amber-400 border-amber-500/30'
        )}>
          {result.recommendation.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-background/40">
          <p className="text-lg font-bold">{Math.round(result.overallConfidence * 100)}%</p>
          <p className="text-[10px] text-muted-foreground">Overall Confidence</p>
        </div>
        <div className="p-2 rounded-lg bg-background/40">
          <p className="text-lg font-bold">{Math.round(result.faceMatchScore * 100)}%</p>
          <p className="text-[10px] text-muted-foreground">Face Match</p>
        </div>
        <div className="p-2 rounded-lg bg-background/40">
          <p className="text-lg font-bold">{Math.round(result.ocrConfidence)}%</p>
          <p className="text-[10px] text-muted-foreground">OCR Confidence</p>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Name Match</span>
          <span className={cn('font-semibold', result.fieldMatches.nameMatch ? 'text-green-400' : 'text-destructive')}>
            {result.fieldMatches.nameMatch ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">ID Number Match</span>
          <span className={cn('font-semibold', result.fieldMatches.idMatch ? 'text-green-400' : 'text-destructive')}>
            {result.fieldMatches.idMatch ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">DOB Match</span>
          <span className={cn('font-semibold', result.fieldMatches.dobMatch ? 'text-green-400' : 'text-destructive')}>
            {result.fieldMatches.dobMatch ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Face Detected (Doc / Selfie)</span>
          <span className="font-semibold">{result.docFaceDetected ? 'Yes' : 'No'} / {result.selfieFaceDetected ? 'Yes' : 'No'}</span>
        </div>
      </div>

      {result.extractedFields.fullName && (
        <div className="p-2 rounded bg-background/40">
          <p className="text-[10px] text-muted-foreground mb-1">OCR Extracted Name</p>
          <p className="text-xs font-mono">{result.extractedFields.fullName}</p>
        </div>
      )}

      {result.rawOcrText && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show raw OCR text</summary>
          <pre className="mt-2 p-2 rounded bg-background/40 text-[10px] text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">{result.rawOcrText}</pre>
        </details>
      )}
    </div>
  );

  const currentSubmissions = activeTab === 'pending'
    ? filterSubmissions(pendingSubmissions)
    : activeTab === 'approved'
    ? filterSubmissions(approvedSubmissions)
    : filterSubmissions(rejectedSubmissions);

  const isLoading = activeTab === 'pending' ? loadingPending : activeTab === 'approved' ? loadingApproved : loadingRejected;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tighter uppercase">KYC Verification</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">
            Identity Document Review &amp; AI Verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" /> {pendingSubmissions?.length || 0} Pending
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or document number..." className="pl-10 bg-background/50"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 rounded-2xl p-1 h-12">
          <TabsTrigger value="pending" className="rounded-xl font-bold text-xs gap-2">
            <Clock className="h-3 w-3" /> Pending ({pendingSubmissions?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="approved" className="rounded-xl font-bold text-xs gap-2">
            <CheckCircle2 className="h-3 w-3" /> Approved ({approvedSubmissions?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-xl font-bold text-xs gap-2">
            <XCircle className="h-3 w-3" /> Rejected ({rejectedSubmissions?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : currentSubmissions && currentSubmissions.length > 0 ? (
            <div className="grid gap-4">
              {currentSubmissions.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))}
            </div>
          ) : (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No {activeTab} Submissions</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'pending' ? 'All KYC submissions have been reviewed.' : `No ${activeTab} KYC submissions found.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> KYC Review</DialogTitle>
            <DialogDescription>Review the identity verification submission.</DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(selectedSubmission.status)}
              </div>

              {/* Photos */}
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

              {/* Auto-verification results */}
              {selectedSubmission.autoVerification && (
                <VerificationResults result={selectedSubmission.autoVerification} />
              )}

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

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wallet Information</h4>
                <div className="text-sm"><span className="text-muted-foreground">Wallet Address</span><p className="font-mono text-xs break-all">{selectedSubmission.walletAddress}</p></div>
              </div>

              {selectedSubmission.withdrawalIntent && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    {selectedSubmission.withdrawalIntent.method === 'EFT'
                      ? <Banknote className="h-4 w-4 text-amber-400" />
                      : <Globe className="h-4 w-4 text-amber-400" />
                    }
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-400">Blocked Withdrawal Intent</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This KYC submission was triggered when the user attempted a cash-out. Approving KYC will allow them to proceed with the following withdrawal:
                  </p>
                  <div className="grid grid-cols-3 gap-3 pt-1 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs block">Amount</span>
                      <p className="font-semibold">{selectedSubmission.withdrawalIntent.currency} {parseFloat(selectedSubmission.withdrawalIntent.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div><span className="text-muted-foreground text-xs block">Method</span><p className="font-semibold">{selectedSubmission.withdrawalIntent.method}</p></div>
                    <div><span className="text-muted-foreground text-xs block">Currency</span><p className="font-semibold">{selectedSubmission.withdrawalIntent.currency}</p></div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Submitted: {formatDate(selectedSubmission.submittedAt)}
              </div>

              {selectedSubmission.status === 'PENDING' && (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-amber-500">Compliance Review:</strong> Verify that the submitted personal information and document details are consistent and match official records.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Rejection Reason (if rejecting)</label>
                    <Textarea placeholder="e.g., Document expired, information mismatch, unclear image..."
                      value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="bg-background/50" />
                  </div>

                  <DialogFooter className="gap-2 flex-wrap">
                    {/* Auto-verify button */}
                    {selectedSubmission.documentImageUrl && selectedSubmission.selfieImageUrl && (
                      <Button
                        variant="secondary"
                        onClick={() => handleAutoVerify(selectedSubmission)}
                        disabled={isVerifying || isProcessing}
                        className="w-full sm:w-auto"
                      >
                        {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <><Scan className="h-4 w-4 mr-2" /> Run AI Verification</>}
                      </Button>
                    )}
                    {selectedSubmission.autoVerification?.recommendation === 'AUTO_APPROVE' && (
                      <Button
                        variant="default"
                        onClick={() => handleApprove(selectedSubmission)}
                        disabled={isProcessing}
                        className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Auto-Approve
                      </Button>
                    )}
                    <Button variant="destructive" onClick={() => handleReject(selectedSubmission)} disabled={isProcessing} className="flex-1 sm:flex-none">
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />} Reject
                    </Button>
                    <Button onClick={() => handleApprove(selectedSubmission)} disabled={isProcessing} className="flex-1 sm:flex-none bg-accent text-accent-foreground hover:bg-accent/90">
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Approve
                    </Button>
                  </DialogFooter>
                </>
              )}

              {selectedSubmission.status === 'REJECTED' && selectedSubmission.rejectionReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">Rejection Reason</h4>
                  <p className="text-sm text-muted-foreground">{selectedSubmission.rejectionReason}</p>
                </div>
              )}

              {selectedSubmission.status === 'APPROVED' && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-green-500 mb-2">Verified</h4>
                  <p className="text-sm text-muted-foreground">This user&apos;s identity has been verified. They can now make withdrawals.</p>
                  {selectedSubmission.reviewedAt && <p className="text-xs text-muted-foreground mt-2">Reviewed: {formatDate(selectedSubmission.reviewedAt)}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
