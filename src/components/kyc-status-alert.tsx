'use client';

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { KYCStatus } from '@/lib/types';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface KycStatusAlertProps {
  kycStatus: KYCStatus;
}

export function KycStatusAlert({ kycStatus }: KycStatusAlertProps) {
  const STATUS_DETAILS = {
    none: {
      icon: <AlertCircle className="h-4 w-4" />,
      title: 'KYC Verification Required',
      description: 'To access the cash-out feature, you need to complete our simple Know Your Customer (KYC) process. This is a one-time verification to ensure the security of your account and comply with financial regulations.',
      button: 'Start KYC Verification',
    },
    pending: {
      icon: <Clock className="h-4 w-4" />,
      title: 'KYC Verification Pending',
      description: 'Your documents have been submitted and are currently under review. This process usually takes 1-2 business days. We appreciate your patience and will notify you via email as soon as the review is complete.',
    },
    verified: {
      icon: <CheckCircle className="h-4 w-4" />,
      title: 'KYC Verified',
      description: 'Your account is fully verified. You can now access all features, including cash-outs.',
    },
  };

  const details = STATUS_DETAILS[kycStatus] || STATUS_DETAILS.none;

  return (
    <Alert>
      {details.icon}
      <AlertTitle>{details.title}</AlertTitle>
      <AlertDescription>
        {details.description}
        {kycStatus === 'none' && (
          <Button size="sm" className="mt-4">{details.button}</Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
