'use client';

import KycVerificationModal from '@/components/kyc-verification-modal';
import { WithdrawalContent } from '@/app/cash-out/withdrawal-content';
import { useKycVerification } from '@/hooks/use-kyc-verification';

/**
 * The parent component for the Cash Out page, responsible for rendering either the 
 * KYC verification modal or the main withdrawal content based on the user's KYC status.
 * This component ensures that unverified users are prompted to complete KYC before 
 * accessing withdrawal functionality.
 */
export default function CashOutPage() {
  const { isKycRequired } = useKycVerification();

  return (
    <>
      <KycVerificationModal />
      {isKycRequired ? null : <WithdrawalContent />}
    </>
  );
}
