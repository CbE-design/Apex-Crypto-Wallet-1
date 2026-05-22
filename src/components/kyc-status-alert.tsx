'use client';

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { KYCStatus } from '@/lib/types';
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import KYCVerificationModal from '@/components/kyc-verification-modal';

interface KycStatusAlertProps {
  kycStatus: KYCStatus;
}

export function KycStatusAlert({ kycStatus }: KycStatusAlertProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const STATUS_DETAILS: Record<KYCStatus, {
    icon: React.ReactNode;
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    button?: string;
  }> = {
    NOT_SUBMITTED: {
      icon: <AlertCircle className="h-4 w-4" />,
      title: 'KYC Verification Required',
      description:
        'To access the cash-out feature you need to complete our Know Your Customer (KYC) process. This is a one-time verification to keep your account secure and meet financial regulations.',
      variant: 'default',
      button: 'Start KYC Verification',
    },
    PENDING: {
      icon: <Clock className="h-4 w-4" />,
      title: 'Verification Under Review',
      description:
        'Your documents have been submitted and are being reviewed. This usually takes 1–2 business days. We will notify you once the review is complete.',
      variant: 'default',
    },
    APPROVED: {
      icon: <CheckCircle className="h-4 w-4" />,
      title: 'KYC Verified',
      description: 'Your identity has been verified. You can access all features including cash-outs.',
      variant: 'default',
    },
    REJECTED: {
      icon: <XCircle className="h-4 w-4" />,
      title: 'Verification Not Approved',
      description:
        'Your identity verification was not approved. Please review the feedback provided and re-submit with the correct documents.',
      variant: 'destructive',
      button: 'Re-submit Documents',
    },
  };

  const details = STATUS_DETAILS[kycStatus] ?? STATUS_DETAILS.NOT_SUBMITTED;

  return (
    <>
      <Alert variant={details.variant}>
        {details.icon}
        <AlertTitle>{details.title}</AlertTitle>
        <AlertDescription>
          {details.description}
          {details.button && (
            <Button
              size="sm"
              className="mt-4 block"
              variant={kycStatus === 'REJECTED' ? 'destructive' : 'default'}
              onClick={() => setIsModalOpen(true)}
            >
              {details.button}
            </Button>
          )}
        </AlertDescription>
      </Alert>

      <KYCVerificationModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}
