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
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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

  const open = propsOpen !== undefined ? propsOpen : hook.isKycModalOpen;
  const setOpen = propsOnOpenChange !== undefined ? propsOnOpenChange : hook.setKycModalOpen;
  const kycStatus = propsKycStatus !== undefined ? propsKycStatus : hook.kycStatus;

  const [step, setStep] = useState<Step>('intro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loadingReason, setLoadingReason] = useState(false);

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);

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

  const compressImage = (file: File, maxWidth = 800, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round(h * (maxWidth / w));
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        resolve(base64);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  };

  const handleSubmit = async () => {
    if (!user) {
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
      console.log('[KYC] Compressing images...');
      const [documentBase64, selfieBase64] = await Promise.all([
        compressImage(documentFile, 800, 0.8),
        compressImage(selfieFile, 800, 0.8),
      ]);
      console.log('[KYC] Images compressed. Doc length:', documentBase64.length, 'Selfie length:', selfieBase64.length);
      console.log('[KYC] Sending to server API...');

      const response = await fetch('/api/kyc/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: userProfile?.email || user.email || 'unknown@apex.io',
          walletAddress: userProfile?.walletAddress || '',
          fullName: formData.fullName,
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          countryCode: formData.countryCode || 'ZA',
          address: formData.address,
          documentType: formData.documentType,
          documentNumber: formData.documentNumber,
          documentExpiry: documentRequiresExpiry ? formData.documentExpiry : 'N/A',
          documentBase64,
          selfieBase64,
          documentFileName: documentFile.name,
          selfieFileName: selfieFile.name,
          withdrawalIntent: withdrawalContext || null,
        }),
      });

      const result = await response.json();
      console.log('[KYC] API response:', result);

      if (!response.ok) {
        throw new Error(result.error || `Server error: ${response.status}`);
      }

      setStep('submitted');
      onSubmissionComplete?.();
      toast({
        title: 'Verification Submitted',
        description: 'Your identity verification is under review.',
      });
    } catch (error: any) {
      console.error('[KYC] CATCH ERROR:', error);
      console.error('[KYC] Error name:', error?.name);
      console.error('[KYC] Error code:', error?.code);
      console.error('[KYC] Error message:', error?.message);
      console.error('[KYC] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      toast({
        title: 'Submission Failed',
        description: error?.message || error?.code || 'Unable to submit verification. Please try again.',
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
            <h3 className="text-lg font-semibold text-white">Verification In Progress</h3>
            <p className="text-sm text-white/40 mt-1 max-w-sm">
              Our compliance team is reviewing your documents. This typically takes 1–2 business days.
            </p>
          </div>
          <Button variant="outline" onClick={() => setOpen(false)} className="border-white/10 text-white/60 hover:text-white hover:bg-white/5">Close</Button>
        </div>
      );
    }
    return null;
  };

  const renderIntro = () => (
    <div className="flex flex-col items-center py-6 text-center gap-6">
      <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 p-5 border border-violet-500/20">
        <Shield className="h-12 w-12 text-violet-400" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-white">Identity Verification</h3>
        <p className="text-sm text-white/40 max-w-sm leading-relaxed">
          Complete our verification process to unlock withdrawals and ensure compliance with financial regulations.
        </p>
      </div>
      <WithdrawalContextBadge />
      <div className="w-full space-y-3">
        {[
          { icon: User, label: 'Personal Information', sub: 'Full legal name, date of birth, residential address' },
          { icon: FileText, label: 'Government ID', sub: 'Valid passport, driver\'s license, or national ID card' },
          { icon: CheckCircle2, label: 'Biometric Verification', sub: 'Selfie photo for identity confirmation' },
          { icon: Clock, label: 'Compliance Review', sub: 'Manual review by our compliance team (1-2 business days)' },
        ].map(({ icon: Icon, label, sub }, idx) => (
          <div key={label} className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left">
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-violet-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">{label}</p>
                <span className="text-[10px] font-bold text-violet-400/60">{idx + 1}</span>
              </div>
              <p className="text-xs text-white/30 mt-1">{sub}</p>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={() => setStep('personal')} className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold">
        Begin Verification Process
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
      <p className="text-[10px] text-white/20 text-center">
        Your information is encrypted and stored securely. We comply with POPIA and GDPR data protection standards.
      </p>
    </div>
  );

  const renderPersonalInfo = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
        <div className="h-6 w-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <User className="h-3 w-3 text-violet-400" />
        </div>
        <h4 className="text-sm font-semibold text-white">Personal Information</h4>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Full Legal Name</Label>
          <Input 
            placeholder="Exactly as shown on government ID" 
            value={formData.fullName} 
            onChange={(e) => handleInputChange('fullName', e.target.value)}
            className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Date of Birth</Label>
            <Input 
              type="date" 
              value={formData.dateOfBirth} 
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Nationality</Label>
            <Select value={formData.nationality} onValueChange={(val) => handleInputChange('nationality', val)}>
              <SelectTrigger className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Residential Address</Label>
          <Input 
            placeholder="Street address, suburb, city, postal code" 
            value={formData.address} 
            onChange={(e) => handleInputChange('address', e.target.value)}
            className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={() => setStep('intro')} className="flex-1 h-11 rounded-xl border-white/10 text-white/60 hover:text-white hover:bg-white/5">Back</Button>
        <Button onClick={() => setStep('document')} disabled={!validatePersonalInfo()} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold">Continue</Button>
      </div>
    </div>
  );

  const renderDocumentInfo = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
        <div className="h-6 w-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <FileText className="h-3 w-3 text-cyan-400" />
        </div>
        <h4 className="text-sm font-semibold text-white">Document Verification</h4>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Document Type</Label>
            <Select value={formData.documentType} onValueChange={(val) => handleInputChange('documentType', val)}>
              <SelectTrigger className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Document Number</Label>
            <Input 
              placeholder="Enter ID number" 
              value={formData.documentNumber} 
              onChange={(e) => handleInputChange('documentNumber', e.target.value)}
              className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 font-mono"
            />
          </div>
        </div>
        {documentRequiresExpiry && (
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Expiry Date</Label>
            <Input 
              type="date" 
              value={formData.documentExpiry} 
              onChange={(e) => handleInputChange('documentExpiry', e.target.value)}
              className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white"
            />
          </div>
        )}
        <div className="space-y-4">
          <DocumentUploadField
            label="Government ID Document"
            sublabel="Clear photo of passport page, driver's license front, or national ID card"
            accept="image/*,.pdf"
            previewUrl={documentPreviewUrl}
            uploading={false}
            error={null}
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
            label="Biometric Selfie"
            sublabel="Clear photo of your face holding your ID document next to it"
            accept="image/*"
            previewUrl={selfiePreviewUrl}
            uploading={false}
            error={null}
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
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={() => setStep('personal')} className="flex-1 h-11 rounded-xl border-white/10 text-white/60 hover:text-white hover:bg-white/5">Back</Button>
        <Button onClick={() => setStep('review')} disabled={!validateDocumentInfo()} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold">Review & Submit</Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
        <div className="h-6 w-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        </div>
        <h4 className="text-sm font-semibold text-white">Review & Confirm</h4>
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
            <User className="h-4 w-4 text-violet-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-white/30">Personal Details</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[10px] text-white/30 uppercase tracking-wider">Full Name</p><p className="font-medium text-white/80">{formData.fullName}</p></div>
            <div><p className="text-[10px] text-white/30 uppercase tracking-wider">Date of Birth</p><p className="font-medium text-white/80">{formData.dateOfBirth}</p></div>
            <div><p className="text-[10px] text-white/30 uppercase tracking-wider">Nationality</p><p className="font-medium text-white/80">{formData.nationality}</p></div>
            <div><p className="text-[10px] text-white/30 uppercase tracking-wider">Country Code</p><p className="font-medium text-white/80">{formData.countryCode}</p></div>
            <div className="col-span-2"><p className="text-[10px] text-white/30 uppercase tracking-wider">Residential Address</p><p className="font-medium text-white/80">{formData.address}</p></div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
            <FileText className="h-4 w-4 text-cyan-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-white/30">Document Information</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[10px] text-white/30 uppercase tracking-wider">Document Type</p><p className="font-medium text-white/80">{formData.documentType}</p></div>
            <div><p className="text-[10px] text-white/30 uppercase tracking-wider">Document Number</p><p className="font-medium text-white/80 font-mono">{formData.documentNumber}</p></div>
            {documentRequiresExpiry && (
              <div><p className="text-[10px] text-white/30 uppercase tracking-wider">Expiry Date</p><p className="font-medium text-white/80">{formData.documentExpiry}</p></div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-white/30">Uploaded Files</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="font-medium text-white/80">ID Document uploaded</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="font-medium text-white/80">Selfie uploaded</p>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
        <p className="text-[11px] text-amber-300/80 leading-relaxed">
        <strong className="text-amber-300">Declaration:</strong> I confirm that all information provided is accurate and complete. I understand that false statements may result in account suspension and legal action.
        </p>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setStep('document')} disabled={isSubmitting} className="flex-1 h-11 rounded-xl border-white/10 text-white/60 hover:text-white hover:bg-white/5">Edit</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Verification'}
        </Button>
      </div>
    </div>
  );

  const renderSubmitted = () => (
    <div className="flex flex-col items-center py-8 text-center gap-5">
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-white">Verification Submitted</h3>
        <p className="text-sm text-white/40 max-w-sm leading-relaxed">
          Your identity verification has been submitted for review. Our compliance team will process your application within 1-2 business days.
        </p>
      </div>
      <div className="w-full space-y-2">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 text-left">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-violet-400" />
            <div>
              <p className="text-xs font-semibold text-white">Expected Processing Time</p>
              <p className="text-[10px] text-white/30">1-2 business days</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 text-left">
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-cyan-400" />
            <div>
              <p className="text-xs font-semibold text-white">Security Status</p>
              <p className="text-[10px] text-white/30">Your documents are encrypted and secure</p>
            </div>
          </div>
        </div>
      </div>
      <Button className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white font-bold" onClick={() => setOpen(false)}>Return to Dashboard</Button>
    </div>
  );

  if (kycStatus === 'PENDING') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-white/[0.08] bg-[#0A0C12]/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Identity Verification</DialogTitle>
            <DialogDescription className="text-white/30">Your identity verification is currently being reviewed.</DialogDescription>
          </DialogHeader>
          {renderStatusView()}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md border-white/[0.08] bg-[#0A0C12]/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-white">{step === 'submitted' ? 'Verification Submitted' : 'Identity Verification'}</DialogTitle>
          <DialogDescription className="text-white/30">
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
