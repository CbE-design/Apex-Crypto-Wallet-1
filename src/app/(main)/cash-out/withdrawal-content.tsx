'use client';

import * as React from 'react';
import { useKycVerification } from '@/hooks/use-kyc-verification';
import { WithdrawalForm } from '@/components/withdrawal-form';
import { WithdrawalHistory } from '@/components/withdrawal-history';
import { KycStatusAlert } from '@/components/kyc-status-alert';

export function WithdrawalContent() {
  const { kycStatus, isProfileLoading } = useKycVerification();

  // Don't render anything while the KYC status is still being fetched — this
  // prevents the KYC banner from flashing briefly before the approved form appears.
  if (isProfileLoading) {
    return null;
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
