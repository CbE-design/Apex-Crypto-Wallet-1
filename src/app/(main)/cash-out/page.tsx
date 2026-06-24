'use client';

import KycVerificationModal from '@/components/kyc-verification-modal';
import { WithdrawalContent } from '@/app/(main)/cash-out/withdrawal-content';

/**
 * Cash Out page. WithdrawalContent handles all KYC states internally:
 * - NOT_SUBMITTED / REJECTED → KycStatusAlert with a button to open the modal
 * - PENDING → KycStatusAlert with a "under review" message
 * - APPROVED → full withdrawal form + history
 *
 * KycVerificationModal is always mounted so KycStatusAlert can open it.
 */
export default function CashOutPage() {
  return (
    <>
      <KycVerificationModal />
      <WithdrawalContent />
    </>
  );
}
