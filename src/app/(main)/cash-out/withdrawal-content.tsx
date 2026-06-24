'use client';

import * as React from 'react';
import { useKycVerification } from '@/hooks/use-kyc-verification';
import { WithdrawalForm } from '@/components/withdrawal-form';
import { WithdrawalHistory } from '@/components/withdrawal-history';
import { KycStatusAlert } from '@/components/kyc-status-alert';
import { Loader2 } from 'lucide-react';

export function WithdrawalContent() {
  const { kycStatus, isKycStatusLoading } = useKycVerification();

  // Show a spinner while auth + Firestore profile are loading.
  // This prevents the KYC banner from flashing for already-approved users.
  if (isKycStatusLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (kycStatus !== 'APPROVED') {
    return (
      <div className="container max-w-2xl py-8">
        <KycStatusAlert kycStatus={kycStatus} />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <WithdrawalForm />
        </div>
        <div className="md:col-span-2">
          <WithdrawalHistory />
        </div>
      </div>
    </div>
  );
}
