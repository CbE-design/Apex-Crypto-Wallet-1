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
import { useStorageUpload } from '@/hooks/use-storage-upload';
import { DocumentUploadField } from '@/components/document-upload-field';
import { 
  Shield, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ArrowRight,
  Loader2,
  Banknote,
  Globe,
} from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';
import type { KYCStatus, KYCSubmission } from '@/lib/types';
import { useKycVerification } from '@/hooks/use-kyc-verification';

export interface WithdrawalContext {
  amount: string;
  currency: string;
  method: 'EFT' | 'SWIFT';
}

interface KYCVerificationModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  kycStatus?: KYCStatus;
  onSubmissionComplete?: () => void;
  withdrawalContext?: WithdrawalContext;
}

type Step = 'intro' | 'personal' | 'document' | 'review' | 'submitted';

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID Card (RSA)' },
];

export default function KycVerificationModal({
  open: propsOpen,
  onOpenChange: propsOnOpenChange,
  kycStatus: propsKycStatus,
  onSubmissionComplete,
  withdrawalContext,
}: KYCVerificationModalProps) {
  const hook = useKycVerification();
  const { user, userProfile } = useWallet();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Handle controlled vs uncontrolled
  const open = propsOpen !== undefined ? propsOpen : hook.isKycModalOpen;
  const setOpen = propsOnOpenChange !== undefined ? propsOnOpenChange : hook.setKycModalOpen;
  const kycStatus = propsKycStatus !== undefined ? propsKycStatus : hook.kycStatus;

  const [step, setStep] = useState<Step>('intro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loadingReason, setLoadingReason] = useState(false);

  // File upload state
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);

  const { upload: uploadToStorage, uploading: upload1Uploading, error: upload1Error } = useStorageUpload();
  const { upload: uploadSelfie, uploading: upload2Uploading, error: upload2Error } = useStorageUpload();

  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    nationality: 'South Africa',
    countryCode: 'ZA',
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
      } catch (err) {
        console.error("Error fetching rejection reason:", err);
      } finally {
        setLoadingReason(false);
      }
    };

    fetchRejectionReason();
  }, [open, kycStatus, user, firestore]);

  const handleInputChange = useCallback((field: string, value: string) => {
    if (field === 'nationality') {
      const country = COUNTRIES.find(c => c.name === value);
      setFormData(prev => ({ ...prev, nationality: value, countryCode: country?.code || 'ZA' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  }, []);

  const validatePersonalInfo = () =>
    formData.fullName && formData.dateOfBirth && formData.nationality && formData.address;

  const documentRequiresExpiry =
    formData.documentType === 'passport' ||
    formData.documentType === 'drivers_license';

  const validateDocumentInfo = () =>
    formData.documentType &&
    formData.documentNumber &&
    (!documentRequiresExpiry || formData.documentExpiry) &&
    documentFile &&
    selfieFile;

  const handleSubmit = async () => {
    if (!user || !firestore) {
      toast({
        title: 'Submission Failed',
        description: 'Connection error. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    if (!documentFile || !selfieFile) {
      toast({
        title: 'Missing Files',
        description: 'Please upload both your document and a selfie.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionId = `kyc_${user.uid}_${Date.now()}`;
      const timestamp = Date.now();

      // Upload document to Firebase Storage
      const docPath = `kyc/${user.uid}/${timestamp}_document.${documentFile.name.split('.').pop()}`;
      const docUrl = await uploadToStorage(documentFile, docPath);
      if (!docUrl) throw new Error('Document upload failed');

      // Upload selfie to Firebase Storage
      const selfiePath = `kyc/${user.uid}/${timestamp}_selfie.${selfieFile.name.split('.').pop()}`;
      const selfieUrl = await uploadSelfie(selfieFile, selfiePath);
      if (!selfieUrl) throw new Error('Selfie upload failed');

      const kycSubmission = {
        id: submissionId,
        userId: user.uid,
        userEmail: userProfile?.email || user.email || 'unknown@apex.io',
        walletAddress: userProfile?.walletAddress || '',
        status: 'PENDING',
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        nationality: formData.nationality,
        countryCode: formData.countryCode || 'ZA',
        address: formData.address,
        documentType: formData.documentType,
        documentNumber: formData.documentNumber,
        documentExpiry: documentRequiresExpiry ? formData.documentExpiry : 'N/A',
        documentImageUrl: docUrl,
        selfieImageUrl: selfieUrl,
        submittedAt: serverTimestamp(),
        ...(withdrawalContext ? { withdrawalIntent: withdrawalContext } : {}),
      };

      await setDoc(doc(firestore, 'kyc_submissions', submissionId), kycSubmission);

      await setDoc(doc(firestore, 'users', user.uid), {
        kycStatus: 'PENDING',
        kycSubmissionId: submissionId,
        kycSubmittedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'KYC_VERIFICATION',
        title: withdrawalContext ? 'Urgent: KYC for Withdrawal' : 'New KYC Submission',
        message: `${formData.fullName} has submitted KYC documents for manual review.`,
        userId: user.uid,
        userEmail: userProfile?.email || 'unknown@apex.io',
        referenceId: submissionId,
        read: false,
        createdAt: serverTimestamp(),
      });

      setStep('submitted');
      onSubmissionComplete?.();
      toast({
        title: 'Verification Submitted',
        description: 'Your identity verification is under review.',
      });

    } catch (error: any) {
      console.error('KYC submission error:', error);
      toast({
        title: 'Submission Failed',
        description: error.message || 'Unable to submit verification. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const WithdrawalContextBadge = () => {
    if (!withdrawalContext) return null;
    const Icon = withdrawalContext.method === 'EFT' ? Banknote : Globe;
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
        <Icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <p className="text-[11px] text-amber-300">
          Verifying to release: <strong>{withdrawalContext.currency} {parseFloat(withdrawalContext.amount).toLocaleString()}</strong>
        </p>
      </div>
    );
  };

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
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </div>
      );
    }
    return null;
  };

  const renderIntro = () => (
    <div className="flex flex-col items-center py-4 text-center gap-5">
      <div className="rounded-full bg-primary/10 p-4 border border-primary/20">
        <Shield className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Verify Your Identity</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          To comply with regulations and ensure account security, we need to verify your identity.
        </p>
      </div>
      <WithdrawalContextBadge />
      <div className="w-full space-y-2.5">
        {[
          { icon: User, label: 'Personal Information', sub: 'Name, DOB, address' },
          { icon: FileText, label: 'Identity Document', sub: 'Passport, DL, or National ID' },
          { icon: CheckCircle2, label: 'Manual Review', sub: 'Verified by our compliance team' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-left">
            <Icon className="h-4 w-4 text-primary shrink-0" />
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
      <div className="space-y-2">
        <Label>Full Legal Name</Label>
        <Input placeholder="As it appears on your ID" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Date of Birth</Label>
        <Input type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Nationality</Label>
        <Select value={formData.nationality} onValueChange={(val) => handleInputChange('nationality', val)}>
          <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
          <SelectContent>
            {COUNTRIES.map(c => <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Residential Address</Label>
        <Input placeholder="Street address, city, postal code" value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setStep('intro')} className="flex-1">Back</Button>
        <Button onClick={() => setStep('document')} disabled={!validatePersonalInfo()} className="flex-1 btn-premium text-white">Continue</Button>
      </div>
    </div>
  );

  const renderDocumentInfo = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Document Type</Label>
        <Select value={formData.documentType} onValueChange={(val) => handleInputChange('documentType', val)}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Document Number</Label>
        <Input placeholder="Enter number" value={formData.documentNumber} onChange={(e) => handleInputChange('documentNumber', e.target.value)} />
      </div>
      {documentRequiresExpiry && (
        <div className="space-y-2">
          <Label>Expiry Date</Label>
          <Input type="date" value={formData.documentExpiry} onChange={(e) => handleInputChange('documentExpiry', e.target.value)} />
        </div>
      )}
      <DocumentUploadField
        label="Upload Document Photo"
        sublabel="ID front or Passport page"
        accept="image/*,.pdf"
        previewUrl={documentPreviewUrl}
        uploading={upload1Uploading}
        error={upload1Error}
        onFileSelect={(file) => {
          setDocumentFile(file);
          const url = URL.createObjectURL(file);
          setDocumentPreviewUrl(url);
        }}
        onClear={() => {
          setDocumentFile(null);
          if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
          setDocumentPreviewUrl(null);
        }}
      />
      <DocumentUploadField
        label="Upload Selfie"
        sublabel="Take a clear photo of your face holding your ID"
        accept="image/*"
        previewUrl={selfiePreviewUrl}
        uploading={upload2Uploading}
        error={upload2Error}
        onFileSelect={(file) => {
          setSelfieFile(file);
          const url = URL.createObjectURL(file);
          setSelfiePreviewUrl(url);
        }}
        onClear={() => {
          setSelfieFile(null);
          if (selfiePreviewUrl) URL.revokeObjectURL(selfiePreviewUrl);
          setSelfiePreviewUrl(null);
        }}
      />
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setStep('personal')} className="flex-1">Back</Button>
        <Button onClick={() => setStep('review')} disabled={!validateDocumentInfo()} className="flex-1 btn-premium text-white">Review</Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 p-4 space-y-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Full Name</p><p className="font-medium">{formData.fullName}</p></div>
        <div><p className="text-xs text-muted-foreground">Document</p><p className="font-medium">{formData.documentType} ({formData.documentNumber})</p></div>
      </div>
      <p className="text-xs text-muted-foreground">
        By submitting, you confirm all information is accurate.
      </p>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setStep('document')} disabled={isSubmitting} className="flex-1">Back</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 btn-premium text-white">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit for Review'}
        </Button>
      </div>
    </div>
  );

  const renderSubmitted = () => (
    <div className="flex flex-col items-center py-6 text-center gap-4">
      <CheckCircle2 className="h-10 w-10 text-accent" />
      <h3 className="text-lg font-semibold">Verification Submitted</h3>
      <p className="text-sm text-muted-foreground">Our compliance team will review your documents. This usually takes 1-2 business days.</p>
      <Button className="btn-premium text-white w-full" onClick={() => setOpen(false)}>Done</Button>
    </div>
  );

  if (kycStatus === 'PENDING') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Identity Verification</DialogTitle>
            <DialogDescription>Your identity verification is currently being reviewed.</DialogDescription>
          </DialogHeader>
          {renderStatusView()}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 'submitted' ? 'Verification Submitted' : 'Identity Verification'}</DialogTitle>
          <DialogDescription>
            {step === 'intro' && 'Follow the steps to complete your identity verification.'}
            {step === 'personal' && 'Please provide your personal information.'}
            {step === 'document' && 'Upload your identity document.'}
            {step === 'review' && 'Review your information before submitting.'}
            {step === 'submitted' && 'Your verification has been submitted.'}
          </DialogDescription>
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
