'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Banknote,
  Globe,
} from 'lucide-react';
import type { KYCStatus, KYCSubmission, AdminNotification } from '@/lib/types';

export interface WithdrawalContext {
  amount: string;
  currency: string;
  method: 'EFT' | 'SWIFT';
}

interface KYCVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kycStatus: KYCStatus;
  onSubmissionComplete?: () => void;
  withdrawalContext?: WithdrawalContext;
}

type Step = 'intro' | 'personal' | 'document' | 'review' | 'submitted';

const COUNTRIES = [
  'South Africa', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'Nigeria', 'Kenya', 'India', 'Japan', 
  'Singapore', 'United Arab Emirates', 'Brazil', 'Mexico',
];

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID Card (RSA)' },
];

export function KYCVerificationModal({
  open,
  onOpenChange,
  kycStatus,
  onSubmissionComplete,
  withdrawalContext,
}: KYCVerificationModalProps) {
  const { user, userProfile, wallet } = useWallet();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('intro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loadingReason, setLoadingReason] = useState(false);
  const [documentFile, setDocumentFile] = useState<{ name: string; size: string } | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    address: '',
    documentType: '' as 'passport' | 'drivers_license' | 'national_id' | '',
    documentNumber: '',
    documentExpiry: '',
  });

  const progress = { intro: 0, personal: 33, document: 66, review: 90, submitted: 100 };

  // Fetch rejection reason when modal opens for a rejected user
  useEffect(() => {
    if (!open || kycStatus !== 'REJECTED' || !user || !firestore) return;

    const fetchRejectionReason = async () => {
      setLoadingReason(true);
      try {
        const q = query(
          collection(firestore, 'kyc_submissions'),
          where('userId', '==', user.uid),
          where('status', '==', 'REJECTED'),
          orderBy('submittedAt', 'desc'),
          limit(1),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data() as KYCSubmission;
          setRejectionReason(data.rejectionReason || null);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingReason(false);
      }
    };

    fetchRejectionReason();
  }, [open, kycStatus, user, firestore]);

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const validatePersonalInfo = () =>
    formData.fullName && formData.dateOfBirth && formData.nationality && formData.address;

  const validateDocumentInfo = () =>
    formData.documentType && formData.documentNumber && formData.documentExpiry;

  const handleSubmit = async () => {
    if (!user || !firestore || !wallet) return;
    
    setIsSubmitting(true);
    try {
      const submissionId = `kyc_${user.uid}_${Date.now()}`;
      
      const kycSubmission: Omit<KYCSubmission, 'id'> = {
        userId: user.uid,
        userEmail: userProfile?.email || 'unknown@apex.io',
        walletAddress: wallet.address,
        status: 'PENDING',
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        nationality: formData.nationality,
        address: formData.address,
        documentType: formData.documentType as 'passport' | 'drivers_license' | 'national_id',
        documentNumber: formData.documentNumber,
        documentExpiry: formData.documentExpiry,
        submittedAt: serverTimestamp(),
      };

      await setDoc(doc(firestore, 'kyc_submissions', submissionId), {
        id: submissionId,
        ...kycSubmission,
        // Store withdrawal intent so admin can see what was being blocked
        ...(withdrawalContext ? { withdrawalIntent: withdrawalContext } : {}),
      });

      await setDoc(doc(firestore, 'users', user.uid), {
        kycStatus: 'PENDING',
        kycSubmissionId: submissionId,
      }, { merge: true });

      // Rich admin notification — include withdrawal context if present
      const notificationTitle = withdrawalContext
        ? `⚠ KYC Required — Withdrawal Blocked: ${withdrawalContext.currency} ${parseFloat(withdrawalContext.amount).toLocaleString()}`
        : 'New KYC Verification Request';

      const notificationMessage = withdrawalContext
        ? `${formData.fullName} (${userProfile?.email}) submitted identity documents to unblock a ${withdrawalContext.method} withdrawal of ${withdrawalContext.currency} ${parseFloat(withdrawalContext.amount).toLocaleString()}. Review KYC to release the withdrawal.`
        : `${formData.fullName} (${userProfile?.email}) has submitted identity verification documents for review.`;

      const notification: Omit<AdminNotification, 'id'> = {
        type: 'KYC_VERIFICATION',
        title: notificationTitle,
        message: notificationMessage,
        userId: user.uid,
        userEmail: userProfile?.email,
        referenceId: submissionId,
        read: false,
        createdAt: serverTimestamp(),
        metadata: {
          documentType: formData.documentType,
          nationality: formData.nationality,
          submissionId,
          withdrawalIntent: withdrawalContext || null,
          fullName: formData.fullName,
          urgent: !!withdrawalContext,
        },
      };

      await addDoc(collection(firestore, 'admin_notifications'), notification);

      setStep('submitted');
      toast({
        title: 'Verification Submitted',
        description: 'Your identity verification is under review. We typically respond within 1–2 business days.',
      });

      onSubmissionComplete?.();
    } catch (error) {
      console.error('KYC submission error:', error);
      toast({
        title: 'Submission Failed',
        description: 'Unable to submit verification. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Withdrawal context badge ──────────────────────────────────────────────
  const WithdrawalContextBadge = () => {
    if (!withdrawalContext) return null;
    const Icon = withdrawalContext.method === 'EFT' ? Banknote : Globe;
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
        <Icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <p className="text-[11px] text-amber-300">
          Verifying to release: <strong>{withdrawalContext.currency} {parseFloat(withdrawalContext.amount).toLocaleString()}</strong> via {withdrawalContext.method}
        </p>
      </div>
    );
  };

  // ── Status views ──────────────────────────────────────────────────────────
  const renderStatusView = () => {
    if (kycStatus === 'PENDING') {
      return (
        <div className="flex flex-col items-center py-6 text-center gap-4">
          <div className="rounded-full bg-amber-500/10 p-4 border border-amber-500/20">
            <Clock className="h-10 w-10 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Verification In Progress</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Our compliance team is reviewing your documents. This typically takes 1–2 business days.
            </p>
          </div>
          {withdrawalContext && (
            <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left">
              <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">Blocked Withdrawal</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-muted-foreground">Amount</p><p className="font-semibold">{withdrawalContext.currency} {parseFloat(withdrawalContext.amount).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Method</p><p className="font-semibold">{withdrawalContext.method}</p></div>
                <div><p className="text-muted-foreground">Status</p><Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-[9px]">Awaiting KYC</Badge></div>
              </div>
            </div>
          )}
          <div className="w-full rounded-xl border border-border/40 bg-muted/20 p-3 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <p className="text-xs text-muted-foreground">Compliance review in progress — you will be notified once complete.</p>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      );
    }

    if (kycStatus === 'REJECTED') {
      return (
        <div className="flex flex-col items-center py-6 text-center gap-4">
          <div className="rounded-full bg-destructive/10 p-4 border border-destructive/20">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Verification Not Approved</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Unfortunately your previous verification was not approved. Please resubmit with valid documents.
            </p>
          </div>

          {loadingReason ? (
            <div className="w-full rounded-xl border border-border/40 bg-muted/20 p-3 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading rejection details...</p>
            </div>
          ) : rejectionReason ? (
            <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left">
              <p className="text-[11px] font-semibold text-destructive uppercase tracking-wider mb-1.5">Reason for Rejection</p>
              <p className="text-sm text-muted-foreground">{rejectionReason}</p>
            </div>
          ) : null}

          <Button 
            onClick={() => setStep('personal')}
            className="w-full btn-premium text-white"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Resubmit Documents
          </Button>
        </div>
      );
    }

    return null;
  };

  // ── Form steps ────────────────────────────────────────────────────────────
  const renderIntro = () => (
    <div className="flex flex-col items-center py-4 text-center gap-5">
      <div className="rounded-full bg-primary/10 p-4 border border-primary/20">
        <Shield className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Verify Your Identity</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          FICA regulations require us to verify your identity before processing withdrawals.
        </p>
      </div>

      <WithdrawalContextBadge />

      <div className="w-full space-y-2.5">
        {[
          { icon: User, label: 'Personal Information', sub: 'Name, date of birth, residential address' },
          { icon: FileText, label: 'Identity Document', sub: 'Passport, driver\'s licence, or SA ID card' },
          { icon: CheckCircle2, label: 'Compliance Review', sub: '1–2 business days — FICA & AML screening' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-left">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={() => setStep('personal')} className="w-full btn-premium text-white">
        Start Verification
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  const renderPersonalInfo = () => (
    <div className="space-y-4">
      <WithdrawalContextBadge />
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Legal Name</Label>
        <Input id="fullName" placeholder="As it appears on your ID" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of Birth</Label>
        <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nationality">Nationality</Label>
        <Select value={formData.nationality} onValueChange={(value) => handleInputChange('nationality', value)}>
          <SelectTrigger><SelectValue placeholder="Select your country" /></SelectTrigger>
          <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Residential Address</Label>
        <Input id="address" placeholder="Street address, city, postal code" value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setStep('intro')} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <Button onClick={() => setStep('document')} disabled={!validatePersonalInfo()} className="flex-1 btn-premium text-white">Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );

  const renderDocumentInfo = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Document Type</Label>
        <Select value={formData.documentType} onValueChange={(value) => handleInputChange('documentType', value)}>
          <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
          <SelectContent>{DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="documentNumber">Document Number</Label>
        <Input id="documentNumber" placeholder="Enter document number" value={formData.documentNumber} onChange={(e) => handleInputChange('documentNumber', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="documentExpiry">Expiry Date</Label>
        <Input id="documentExpiry" type="date" value={formData.documentExpiry} onChange={(e) => handleInputChange('documentExpiry', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Document Image</Label>
        <label
          htmlFor="doc-upload"
          className={[
            'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all',
            documentFile
              ? 'border-accent/40 bg-accent/5'
              : 'border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5',
          ].join(' ')}
        >
          <input
            id="doc-upload"
            type="file"
            accept="image/*,.pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const kb = file.size / 1024;
                setDocumentFile({
                  name: file.name,
                  size: kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`,
                });
              }
            }}
          />
          {documentFile ? (
            <>
              <CheckCircle2 className="h-7 w-7 text-accent" />
              <p className="text-sm font-semibold text-accent">Document Attached</p>
              <p className="text-xs text-muted-foreground font-mono truncate max-w-[220px]">{documentFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{documentFile.size} · <span className="underline">Change file</span></p>
            </>
          ) : (
            <>
              <Upload className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-semibold">Upload Document Image</p>
              <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 10 MB</p>
              <p className="text-[10px] text-muted-foreground mt-1">Your document is encrypted end-to-end and processed in compliance with POPIA.</p>
            </>
          )}
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setStep('personal')} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <Button onClick={() => setStep('review')} disabled={!validateDocumentInfo()} className="flex-1 btn-premium text-white">Review<ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      {withdrawalContext && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-primary/60 mb-2">Withdrawal to Unlock</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">{withdrawalContext.currency} {parseFloat(withdrawalContext.amount).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted-foreground">Method</span>
            <span className="font-semibold">{withdrawalContext.method}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal Information</h4>
        {[
          ['Full Name', formData.fullName],
          ['Date of Birth', formData.dateOfBirth],
          ['Nationality', formData.nationality],
          ['Address', formData.address]
        ].map(([label, val]) => (
          <div key={label} className="text-sm">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="font-medium break-words">{val}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity Document</h4>
        {[
          ['Document Type', formData.documentType.replace('_', ' ')],
          ['Document Number', formData.documentNumber],
          ['Expiry Date', formData.documentExpiry]
        ].map(([label, val]) => (
          <div key={label} className="text-sm">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="font-medium capitalize">{val}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="text-xs text-amber-400">
          By submitting, you confirm all information is accurate and matches your official documents. False declarations are an offence under FICA.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setStep('document')} disabled={isSubmitting} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 btn-premium text-white">
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : <>Submit Verification<CheckCircle2 className="ml-2 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );

  const renderSubmitted = () => (
    <div className="flex flex-col items-center py-6 text-center gap-4">
      <div className="rounded-full bg-accent/10 p-4 border border-accent/20">
        <CheckCircle2 className="h-10 w-10 text-accent" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Verification Submitted</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Our compliance team has been notified and will review your documents. You&apos;ll be notified once approved.
        </p>
      </div>
      {withdrawalContext && (
        <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left">
          <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">Your Withdrawal</p>
          <p className="text-sm text-muted-foreground">Once your identity is verified, you can return to the withdrawal page to submit your <strong className="text-foreground">{withdrawalContext.currency} {parseFloat(withdrawalContext.amount).toLocaleString()} {withdrawalContext.method}</strong> withdrawal.</p>
        </div>
      )}
      <div className="w-full rounded-xl border border-border/40 bg-muted/20 p-3 flex items-center gap-3">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">Expected review: 1–2 business days</span>
      </div>
      <Button className="btn-premium text-white w-full" onClick={() => onOpenChange(false)}>Done</Button>
    </div>
  );

  const getStepTitle = () => {
    switch (step) {
      case 'personal': return 'Personal Information';
      case 'document': return 'Identity Document';
      case 'review': return 'Review & Submit';
      default: return 'Identity Verification (FICA)';
    }
  };

  if (kycStatus === 'PENDING' || kycStatus === 'REJECTED') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>Identity Verification</DialogTitle>
            <DialogDescription className="sr-only">KYC status</DialogDescription>
          </DialogHeader>
          {renderStatusView()}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription className="sr-only">Please follow the steps to complete identity verification.</DialogDescription>
        </DialogHeader>
        {step !== 'intro' && step !== 'submitted' && <Progress value={progress[step]} className="h-1" />}
        {step === 'intro' && renderIntro()}
        {step === 'personal' && renderPersonalInfo()}
        {step === 'document' && renderDocumentInfo()}
        {step === 'review' && renderReview()}
        {step === 'submitted' && renderSubmitted()}
      </DialogContent>
    </Dialog>
  );
}
