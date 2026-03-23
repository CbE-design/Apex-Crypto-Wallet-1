'use client';

import { useState, useCallback } from 'react';
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
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
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
  Loader2
} from 'lucide-react';
import type { KYCStatus, KYCSubmission, AdminNotification } from '@/lib/types';

interface KYCVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kycStatus: KYCStatus;
  onSubmissionComplete?: () => void;
}

type Step = 'intro' | 'personal' | 'document' | 'review' | 'submitted';

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
  'France', 'South Africa', 'Nigeria', 'Kenya', 'India', 'Japan', 
  'Singapore', 'United Arab Emirates', 'Brazil', 'Mexico'
];

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID Card' },
];

export function KYCVerificationModal({
  open,
  onOpenChange,
  kycStatus,
  onSubmissionComplete,
}: KYCVerificationModalProps) {
  const { user, userProfile, wallet } = useWallet();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('intro');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    address: '',
    documentType: '' as 'passport' | 'drivers_license' | 'national_id' | '',
    documentNumber: '',
    documentExpiry: '',
  });

  const progress = {
    intro: 0,
    personal: 33,
    document: 66,
    review: 90,
    submitted: 100,
  };

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const validatePersonalInfo = () => {
    return formData.fullName && formData.dateOfBirth && formData.nationality && formData.address;
  };

  const validateDocumentInfo = () => {
    return formData.documentType && formData.documentNumber && formData.documentExpiry;
  };

  const handleSubmit = async () => {
    if (!user || !firestore || !wallet) return;
    
    setIsSubmitting(true);
    try {
      const submissionId = `kyc_${user.uid}_${Date.now()}`;
      
      // Create KYC submission
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

      // Save KYC submission
      await setDoc(doc(firestore, 'kyc_submissions', submissionId), {
        id: submissionId,
        ...kycSubmission,
      });

      // Update user's KYC status
      await setDoc(doc(firestore, 'users', user.uid), {
        kycStatus: 'PENDING',
        kycSubmissionId: submissionId,
      }, { merge: true });

      // Create admin notification
      const notification: Omit<AdminNotification, 'id'> = {
        type: 'KYC_VERIFICATION',
        title: 'New KYC Verification Request',
        message: `${formData.fullName} (${userProfile?.email}) has submitted identity verification documents for review.`,
        userId: user.uid,
        userEmail: userProfile?.email,
        referenceId: submissionId,
        read: false,
        createdAt: serverTimestamp(),
        metadata: {
          documentType: formData.documentType,
          nationality: formData.nationality,
        },
      };

      await addDoc(collection(firestore, 'admin_notifications'), notification);

      setStep('submitted');
      toast({
        title: 'Verification Submitted',
        description: 'Your identity verification is under review. This typically takes 1-2 business days.',
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

  const renderStatusView = () => {
    if (kycStatus === 'PENDING') {
      return (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-4 rounded-full bg-amber-500/10 p-4">
            <Clock className="h-12 w-12 text-amber-500" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">Verification In Progress</h3>
          <p className="mb-6 max-w-sm text-muted-foreground">
            Your identity verification is currently being reviewed by our compliance team. 
            This process typically takes 1-2 business days.
          </p>
          <div className="w-full max-w-xs rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              <span className="text-sm text-muted-foreground">Review in progress...</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      );
    }

    if (kycStatus === 'REJECTED') {
      return (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-4 rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">Verification Unsuccessful</h3>
          <p className="mb-6 max-w-sm text-muted-foreground">
            Unfortunately, your identity verification was not approved. 
            Please submit new documents to try again.
          </p>
          <Button 
            onClick={() => setStep('personal')}
            className="bg-primary text-primary-foreground"
          >
            Submit New Documents
          </Button>
        </div>
      );
    }

    return null;
  };

  const renderIntro = () => (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="mb-4 rounded-full bg-primary/10 p-4">
        <Shield className="h-12 w-12 text-primary" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">Verify Your Identity</h3>
      <p className="mb-6 max-w-sm text-muted-foreground">
        To comply with financial regulations and protect your assets, 
        we need to verify your identity before processing withdrawals.
      </p>
      
      <div className="mb-6 w-full space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-left">
          <User className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Personal Information</p>
            <p className="text-xs text-muted-foreground">Name, date of birth, address</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-left">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Identity Document</p>
            <p className="text-xs text-muted-foreground">Passport, driver&apos;s license, or ID card</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-left">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Quick Review</p>
            <p className="text-xs text-muted-foreground">Usually verified within 1-2 business days</p>
          </div>
        </div>
      </div>

      <Button 
        onClick={() => setStep('personal')}
        className="w-full bg-primary text-primary-foreground"
      >
        Start Verification
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  const renderPersonalInfo = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Legal Name</Label>
        <Input
          id="fullName"
          placeholder="As it appears on your ID"
          value={formData.fullName}
          onChange={(e) => handleInputChange('fullName', e.target.value)}
          className="bg-background"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of Birth</Label>
        <Input
          id="dateOfBirth"
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
          className="bg-background"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nationality">Nationality</Label>
        <Select 
          value={formData.nationality}
          onValueChange={(value) => handleInputChange('nationality', value)}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select your country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map(country => (
              <SelectItem key={country} value={country}>{country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Residential Address</Label>
        <Input
          id="address"
          placeholder="Street address, city, postal code"
          value={formData.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          className="bg-background"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          variant="outline" 
          onClick={() => setStep('intro')}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={() => setStep('document')}
          disabled={!validatePersonalInfo()}
          className="flex-1 bg-primary text-primary-foreground"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderDocumentInfo = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Document Type</Label>
        <Select 
          value={formData.documentType}
          onValueChange={(value) => handleInputChange('documentType', value)}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map(doc => (
              <SelectItem key={doc.value} value={doc.value}>{doc.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="documentNumber">Document Number</Label>
        <Input
          id="documentNumber"
          placeholder="Enter document number"
          value={formData.documentNumber}
          onChange={(e) => handleInputChange('documentNumber', e.target.value)}
          className="bg-background"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="documentExpiry">Expiry Date</Label>
        <Input
          id="documentExpiry"
          type="date"
          value={formData.documentExpiry}
          onChange={(e) => handleInputChange('documentExpiry', e.target.value)}
          className="bg-background"
        />
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
        <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Document Upload</p>
        <p className="text-xs text-muted-foreground">
          For this simulation, document upload is not required.
          In production, users would upload document images here.
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          variant="outline" 
          onClick={() => setStep('personal')}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={() => setStep('review')}
          disabled={!validateDocumentInfo()}
          className="flex-1 bg-primary text-primary-foreground"
        >
          Review
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Personal Information</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Full Name</span>
            <span className="font-medium text-foreground">{formData.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date of Birth</span>
            <span className="font-medium text-foreground">{formData.dateOfBirth}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nationality</span>
            <span className="font-medium text-foreground">{formData.nationality}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Address</span>
            <span className="truncate max-w-[200px] font-medium text-foreground">{formData.address}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Identity Document</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Document Type</span>
            <span className="font-medium text-foreground capitalize">
              {formData.documentType.replace('_', ' ')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Document Number</span>
            <span className="font-medium text-foreground">{formData.documentNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expiry Date</span>
            <span className="font-medium text-foreground">{formData.documentExpiry}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          By submitting, you confirm that all information provided is accurate and matches your official documents.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <Button 
          variant="outline" 
          onClick={() => setStep('document')}
          className="flex-1"
          disabled={isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-primary text-primary-foreground"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit Verification
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderSubmitted = () => (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="mb-4 rounded-full bg-green-500/10 p-4">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">Verification Submitted</h3>
      <p className="mb-6 max-w-sm text-muted-foreground">
        Thank you for submitting your verification documents. Our compliance team will review 
        your submission and notify you once verified.
      </p>
      <div className="w-full max-w-xs rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Expected review time: 1-2 business days
          </span>
        </div>
      </div>
      <Button 
        className="mt-6 bg-primary text-primary-foreground"
        onClick={() => onOpenChange(false)}
      >
        Done
      </Button>
    </div>
  );

  const getStepTitle = () => {
    switch (step) {
      case 'personal': return 'Personal Information';
      case 'document': return 'Identity Document';
      case 'review': return 'Review & Submit';
      default: return 'Identity Verification';
    }
  };

  // Show status view if already submitted
  if (kycStatus === 'PENDING' || kycStatus === 'REJECTED') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Identity Verification</DialogTitle>
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
          <DialogTitle className="text-foreground">{getStepTitle()}</DialogTitle>
          {step !== 'intro' && step !== 'submitted' && (
            <DialogDescription className="sr-only">
              Complete the verification process
            </DialogDescription>
          )}
        </DialogHeader>
        
        {step !== 'intro' && step !== 'submitted' && (
          <Progress value={progress[step]} className="h-1" />
        )}
        
        {step === 'intro' && renderIntro()}
        {step === 'personal' && renderPersonalInfo()}
        {step === 'document' && renderDocumentInfo()}
        {step === 'review' && renderReview()}
        {step === 'submitted' && renderSubmitted()}
      </DialogContent>
    </Dialog>
  );
}
