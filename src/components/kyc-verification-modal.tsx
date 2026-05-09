'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck, ArrowRight, CheckCircle2, Clock, XCircle,
  Loader2, User, FileText, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { useKycVerification } from '@/hooks/use-kyc-verification';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { KYCStatus } from '@/lib/types';

interface KYCVerificationModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  kycStatus?: KYCStatus;
  onSubmissionComplete?: () => void;
}

type Step = 'status' | 'personal' | 'document' | 'review' | 'done';

interface FormData {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  address: string;
  documentType: 'passport' | 'drivers_license' | 'national_id';
  documentNumber: string;
  documentExpiry: string;
}

const INITIAL_FORM: FormData = {
  fullName: '',
  dateOfBirth: '',
  nationality: '',
  address: '',
  documentType: 'national_id',
  documentNumber: '',
  documentExpiry: '',
};

const DOC_LABELS: Record<FormData['documentType'], string> = {
  passport: 'Passport',
  drivers_license: "Driver's Licence",
  national_id: 'SA National ID',
};

export default function KycVerificationModal(props: KYCVerificationModalProps) {
  const hook = useKycVerification();
  const { user, userProfile } = useWallet();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isControlled = props.open !== undefined;
  const open = isControlled ? (props.open ?? false) : hook.isKycModalOpen;
  const setOpen = isControlled
    ? (v: boolean) => props.onOpenChange?.(v)
    : hook.setKycModalOpen;
  const kycStatus: KYCStatus = props.kycStatus ?? hook.kycStatus;

  const [step, setStep] = useState<Step>(() => {
    if (kycStatus === 'APPROVED' || kycStatus === 'PENDING') return 'status';
    return 'personal';
  });
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      if (kycStatus === 'APPROVED' || kycStatus === 'PENDING') {
        setStep('status');
      } else {
        setStep('personal');
        setForm(INITIAL_FORM);
        setErrors({});
      }
    }
  }, [open, kycStatus]);

  const documentRequiresExpiry = form.documentType !== 'national_id';

  const set = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validatePersonal = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required';
    if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required';
    if (!form.nationality.trim()) errs.nationality = 'Nationality is required';
    if (!form.address.trim()) errs.address = 'Residential address is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateDocument = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.documentNumber.trim()) errs.documentNumber = 'Document number is required';
    if (form.documentType === 'national_id' && !/^\d{13}$/.test(form.documentNumber.trim())) {
      errs.documentNumber = 'SA National ID must be exactly 13 digits';
    }
    if (documentRequiresExpiry && !form.documentExpiry) {
      errs.documentExpiry = 'Expiry date is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!user || !firestore) return;
    setSubmitting(true);
    try {
      const walletAddress = userProfile?.walletAddress || '';
      const userEmail = userProfile?.email || '';

      await addDoc(collection(firestore, 'kyc_submissions'), {
        userId: user.uid,
        userEmail,
        walletAddress,
        status: 'PENDING',
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth,
        nationality: form.nationality.trim(),
        address: form.address.trim(),
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim(),
        documentExpiry: documentRequiresExpiry ? form.documentExpiry : 'N/A',
        submittedAt: serverTimestamp(),
      });

      await updateDoc(doc(firestore, 'users', user.uid), {
        kycStatus: 'PENDING',
      });

      await addDoc(collection(firestore, 'admin_notifications'), {
        type: 'KYC_VERIFICATION',
        title: 'New KYC Submission',
        message: `${form.fullName} has submitted KYC documents for review.`,
        userId: user.uid,
        userEmail,
        read: false,
        createdAt: serverTimestamp(),
      });

      setStep('done');
      props.onSubmissionComplete?.();
    } catch (err) {
      console.error('[KYC] submission failed:', err);
      toast({
        title: 'Submission Failed',
        description: 'Could not submit your documents. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = () => {
    if (kycStatus === 'APPROVED') {
      return (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="h-16 w-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Identity Verified</h3>
            <p className="text-sm text-muted-foreground mt-1">Your account is fully verified and all features are available.</p>
          </div>
          <Button className="w-full h-11 rounded-xl btn-premium text-white font-semibold" onClick={() => setOpen(false)}>
            Continue
          </Button>
        </div>
      );
    }

    if (kycStatus === 'PENDING') {
      return (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Under Review</h3>
            <p className="text-sm text-muted-foreground mt-1">Your documents have been submitted and are being reviewed. This typically takes 1–2 business days.</p>
          </div>
          <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      );
    }

    return null;
  };

  const renderPersonal = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Full Legal Name</Label>
        <Input
          className={cn('h-11 rounded-xl bg-muted/30', errors.fullName && 'border-destructive')}
          placeholder="e.g. Thabo Nkosi"
          value={form.fullName}
          onChange={e => set('fullName', e.target.value)}
        />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Date of Birth</Label>
        <Input
          type="date"
          className={cn('h-11 rounded-xl bg-muted/30', errors.dateOfBirth && 'border-destructive')}
          value={form.dateOfBirth}
          onChange={e => set('dateOfBirth', e.target.value)}
        />
        {errors.dateOfBirth && <p className="text-xs text-destructive">{errors.dateOfBirth}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Nationality</Label>
        <Input
          className={cn('h-11 rounded-xl bg-muted/30', errors.nationality && 'border-destructive')}
          placeholder="e.g. South African"
          value={form.nationality}
          onChange={e => set('nationality', e.target.value)}
        />
        {errors.nationality && <p className="text-xs text-destructive">{errors.nationality}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Residential Address</Label>
        <Input
          className={cn('h-11 rounded-xl bg-muted/30', errors.address && 'border-destructive')}
          placeholder="Street, City, Province, Postal Code"
          value={form.address}
          onChange={e => set('address', e.target.value)}
        />
        {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
      </div>
      <Button
        className="w-full h-11 rounded-xl btn-premium text-white font-semibold mt-2"
        onClick={() => { if (validatePersonal()) setStep('document'); }}
      >
        Continue <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );

  const renderDocument = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Document Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {(['national_id', 'passport', 'drivers_license'] as const).map(dt => (
            <button
              key={dt}
              onClick={() => { set('documentType', dt); set('documentNumber', ''); set('documentExpiry', ''); }}
              className={cn(
                'px-2 py-2.5 rounded-xl text-[11px] font-semibold border transition-all text-center',
                form.documentType === dt
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/20',
              )}
            >
              {DOC_LABELS[dt]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Document Number</Label>
        <Input
          className={cn('h-11 rounded-xl bg-muted/30 font-mono', errors.documentNumber && 'border-destructive')}
          placeholder={form.documentType === 'national_id' ? '13-digit RSA ID number' : 'Document number'}
          value={form.documentNumber}
          onChange={e => set('documentNumber', e.target.value)}
        />
        {errors.documentNumber && <p className="text-xs text-destructive">{errors.documentNumber}</p>}
      </div>
      {documentRequiresExpiry ? (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Expiry Date</Label>
          <Input
            type="date"
            className={cn('h-11 rounded-xl bg-muted/30', errors.documentExpiry && 'border-destructive')}
            value={form.documentExpiry}
            onChange={e => set('documentExpiry', e.target.value)}
          />
          {errors.documentExpiry && <p className="text-xs text-destructive">{errors.documentExpiry}</p>}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
          <p className="text-xs text-muted-foreground">
            South African National IDs do not have an expiry date. Your 13-digit ID number is sufficient for verification.
          </p>
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep('personal')}>
          Back
        </Button>
        <Button
          className="flex-1 h-11 rounded-xl btn-premium text-white font-semibold"
          onClick={() => { if (validateDocument()) setStep('review'); }}
        >
          Review <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/40 bg-muted/20 divide-y divide-border/30 overflow-hidden">
        <div className="px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Personal Information</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{form.fullName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date of Birth</span><span className="font-medium">{form.dateOfBirth}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nationality</span><span className="font-medium">{form.nationality}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Address</span><span className="font-medium text-right text-xs">{form.address}</span></div>
          </div>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Identity Document</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{DOC_LABELS[form.documentType]}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Number</span><span className="font-mono font-medium">{form.documentNumber}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expiry</span>
              <span className="font-medium">{documentRequiresExpiry ? form.documentExpiry : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        By submitting you confirm the information is accurate. False declarations may result in account suspension under FICA regulations.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep('document')} disabled={submitting}>
          Back
        </Button>
        <Button
          className="flex-1 h-11 rounded-xl btn-premium text-white font-semibold"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit <ShieldCheck className="h-4 w-4 ml-1" /></>}
        </Button>
      </div>
    </div>
  );

  const renderDone = () => (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="h-16 w-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-accent" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Documents Submitted</h3>
        <p className="text-sm text-muted-foreground mt-1">Your KYC documents are under review. We'll notify you once verified — usually within 1–2 business days.</p>
      </div>
      <Button className="w-full h-11 rounded-xl btn-premium text-white font-semibold" onClick={() => setOpen(false)}>
        Done
      </Button>
    </div>
  );

  const STEP_LABELS: Record<Step, string> = {
    status: '',
    personal: 'Step 1 of 3 — Personal Details',
    document: 'Step 2 of 3 — Identity Document',
    review: 'Step 3 of 3 — Review & Submit',
    done: '',
  };

  if (!open) return null;

  const isStatusOnlyStep = step === 'status' || step === 'done';

  return (
    <Dialog open={open} onOpenChange={isStatusOnlyStep ? setOpen : () => {}}>
      <DialogContent
        className="sm:max-w-md rounded-2xl border-border/60 bg-card"
        onInteractOutside={e => { if (!isStatusOnlyStep) e.preventDefault(); }}
        onEscapeKeyDown={e => { if (!isStatusOnlyStep) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-[11px] uppercase tracking-widest font-semibold text-primary">
              Identity Verification
            </span>
          </div>
          <DialogTitle className="text-[17px] font-semibold">
            {step === 'status' && kycStatus === 'APPROVED' && 'Account Verified'}
            {step === 'status' && kycStatus === 'PENDING' && 'Verification Pending'}
            {step === 'personal' && 'Personal Details'}
            {step === 'document' && 'Identity Document'}
            {step === 'review' && 'Review & Submit'}
            {step === 'done' && 'Submitted Successfully'}
          </DialogTitle>
          {!isStatusOnlyStep && (
            <DialogDescription className="text-xs text-muted-foreground">
              {STEP_LABELS[step]}
            </DialogDescription>
          )}
          {!isStatusOnlyStep && kycStatus === 'REJECTED' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 mt-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">Your previous submission was rejected. Please re-submit with correct details.</p>
            </div>
          )}
        </DialogHeader>

        <div className="mt-2">
          {step === 'status' && renderStatus()}
          {step === 'personal' && renderPersonal()}
          {step === 'document' && renderDocument()}
          {step === 'review' && renderReview()}
          {step === 'done' && renderDone()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
