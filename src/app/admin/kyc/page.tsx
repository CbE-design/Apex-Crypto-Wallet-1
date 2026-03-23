'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  orderBy, 
  doc, 
  updateDoc, 
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Search,
  User,
  FileText,
  Shield,
  Calendar,
  MapPin,
  Eye,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import type { KYCSubmission, KYCStatus } from '@/lib/types';

export default function KYCApprovalsPage() {
  const { user } = useWallet();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Fetch KYC submissions
  const kycRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'kyc_submissions');
  }, [firestore]);

  const pendingQuery = useMemoFirebase(() => {
    if (!kycRef) return null;
    return query(kycRef, where('status', '==', 'PENDING'), orderBy('submittedAt', 'desc'));
  }, [kycRef]);

  const approvedQuery = useMemoFirebase(() => {
    if (!kycRef) return null;
    return query(kycRef, where('status', '==', 'APPROVED'), orderBy('submittedAt', 'desc'));
  }, [kycRef]);

  const rejectedQuery = useMemoFirebase(() => {
    if (!kycRef) return null;
    return query(kycRef, where('status', '==', 'REJECTED'), orderBy('submittedAt', 'desc'));
  }, [kycRef]);

  const { data: pendingSubmissions, isLoading: loadingPending } = useCollection<KYCSubmission>(pendingQuery);
  const { data: approvedSubmissions, isLoading: loadingApproved } = useCollection<KYCSubmission>(approvedQuery);
  const { data: rejectedSubmissions, isLoading: loadingRejected } = useCollection<KYCSubmission>(rejectedQuery);

  const handleApprove = useCallback(async (submission: KYCSubmission) => {
    if (!firestore || !user) return;
    
    setIsProcessing(true);
    try {
      // Update KYC submission status
      const submissionRef = doc(firestore, 'kyc_submissions', submission.id);
      await updateDoc(submissionRef, {
        status: 'APPROVED',
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
      });

      // Update user's KYC status
      const userRef = doc(firestore, 'users', submission.userId);
      await updateDoc(userRef, {
        kycStatus: 'APPROVED',
        kycApprovedAt: serverTimestamp(),
      });

      // Create notification for user
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

      toast({
        title: 'KYC Approved',
        description: `Successfully approved KYC for ${submission.fullName}. User can now make withdrawals.`,
      });
      
      setIsDetailOpen(false);
      setSelectedSubmission(null);
    } catch (error) {
      console.error('Error approving KYC:', error);
      toast({
        title: 'Approval Failed',
        description: 'Failed to approve KYC submission. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [firestore, user, toast]);

  const handleReject = useCallback(async (submission: KYCSubmission) => {
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
      // Update KYC submission status
      const submissionRef = doc(firestore, 'kyc_submissions', submission.id);
      await updateDoc(submissionRef, {
        status: 'REJECTED',
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
        rejectionReason: rejectionReason.trim(),
      });

      // Update user's KYC status
      const userRef = doc(firestore, 'users', submission.userId);
      await updateDoc(userRef, {
        kycStatus: 'REJECTED',
      });

      // Create notification for user
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

      toast({
        title: 'KYC Rejected',
        description: `KYC for ${submission.fullName} has been rejected.`,
      });
      
      setIsDetailOpen(false);
      setSelectedSubmission(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting KYC:', error);
      toast({
        title: 'Rejection Failed',
        description: 'Failed to reject KYC submission. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [firestore, user, rejectionReason, toast]);

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
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      passport: 'Passport',
      drivers_license: "Driver's License",
      national_id: 'National ID Card',
    };
    return labels[type] || type;
  };

  const filterSubmissions = (submissions: KYCSubmission[] | null) => {
    if (!submissions || !searchQuery.trim()) return submissions;
    const query = searchQuery.toLowerCase();
    return submissions.filter(s => 
      s.userEmail?.toLowerCase().includes(query) ||
      s.fullName?.toLowerCase().includes(query) ||
      s.documentNumber?.toLowerCase().includes(query)
    );
  };

  const SubmissionCard = ({ submission }: { submission: KYCSubmission }) => (
    <Card 
      className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer"
      onClick={() => {
        setSelectedSubmission(submission);
        setIsDetailOpen(true);
      }}
    >
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
                  {getDocumentTypeLabel(submission.documentType)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{submission.nationality}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            {getStatusBadge(submission.status)}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(submission.submittedAt)}
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            <Eye className="h-3 w-3 mr-1" /> Review
          </Button>
        </div>
      </CardContent>
    </Card>
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
            Identity Document Review & Approval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" />
            {pendingSubmissions?.length || 0} Pending
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or document number..."
            className="pl-10 bg-background/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
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
                  {activeTab === 'pending' 
                    ? 'All KYC submissions have been reviewed.' 
                    : `No ${activeTab} KYC submissions found.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* KYC Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              KYC Review
            </DialogTitle>
            <DialogDescription>
              Review the identity verification submission.
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(selectedSubmission.status)}
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Full Name</span>
                    <p className="font-semibold">{selectedSubmission.fullName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-semibold truncate">{selectedSubmission.userEmail}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date of Birth</span>
                    <p className="font-semibold flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {selectedSubmission.dateOfBirth}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nationality</span>
                    <p className="font-semibold flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedSubmission.nationality}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Address</span>
                    <p className="font-semibold">{selectedSubmission.address}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity Document</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Document Type</span>
                    <p className="font-semibold flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {getDocumentTypeLabel(selectedSubmission.documentType)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Document Number</span>
                    <p className="font-mono font-semibold">{selectedSubmission.documentNumber}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expiry Date</span>
                    <p className="font-semibold">{selectedSubmission.documentExpiry}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wallet Information</h4>
                <div className="text-sm">
                  <span className="text-muted-foreground">Wallet Address</span>
                  <p className="font-mono text-xs break-all">{selectedSubmission.walletAddress}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Submitted: {formatDate(selectedSubmission.submittedAt)}
              </div>

              {selectedSubmission.status === 'PENDING' && (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-amber-500">Important:</strong> Verify that the submitted information matches the document. In production, document images would be displayed here for verification.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Rejection Reason (if rejecting)</label>
                    <Textarea
                      placeholder="e.g., Document expired, information mismatch, unclear image..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedSubmission)}
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedSubmission)}
                      disabled={isProcessing}
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve
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
                  <p className="text-sm text-muted-foreground">
                    This user&apos;s identity has been verified. They can now make withdrawals.
                  </p>
                  {selectedSubmission.reviewedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Reviewed: {formatDate(selectedSubmission.reviewedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
