'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useKycVerification } from '@/hooks/use-kyc-verification';
import { WithdrawalForm } from '@/components/withdrawal-form';
import { WithdrawalHistory } from '@/components/withdrawal-history';
import { KycStatusAlert } from '@/components/kyc-status-alert';
import { Loader2 } from 'lucide-react';

export function WithdrawalContent() {
  const { kycStatus } = useKycVerification();

  // We don't show the KYC banner immediately — the kycStatus defaults to
  // 'NOT_SUBMITTED' while Firestore is still loading, which would wrongly show
  // the banner to approved users. Instead we wait up to 1.5 s for the real
  // status to arrive, then commit to whatever we have.
  const [bannerReady, setBannerReady] = useState(false);

  useEffect(() => {
    // If status is already APPROVED, nothing to do.
    if (kycStatus === 'APPROVED') {
      setBannerReady(false);
      return;
    }

    // Wait 1.5 s before showing the KYC banner. If APPROVED arrives in the
    // meantime the effect will re-run and cancel this timer.
    const timer = setTimeout(() => setBannerReady(true), 1500);
    return () => clearTimeout(timer);
  }, [kycStatus]);

  // Approved → show the form immediately.
  if (kycStatus === 'APPROVED') {
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

  // Not approved yet — show a spinner until the timer fires.
  if (!bannerReady) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Timer elapsed and status is definitively not APPROVED.
  return (
    <div className="container max-w-2xl py-8">
      <KycStatusAlert kycStatus={kycStatus} />
    </div>
  );
}
