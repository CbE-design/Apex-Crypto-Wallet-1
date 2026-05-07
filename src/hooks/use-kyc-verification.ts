'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase/firestore/use-user';
import type { KYCStatus } from '@/lib/types';

export const useKycVerification = () => {
  const { user, userData } = useUser();
  const [isKycModalOpen, setKycModalOpen] = useState(false);

  const kycStatus: KYCStatus = userData?.kycStatus || 'none';
  const isKycRequired = !!user && (kycStatus === 'none' || kycStatus === 'pending');

  useEffect(() => {
    // Automatically open the modal if KYC is required
    if (isKycRequired) {
      setKycModalOpen(true);
    } else {
      setKycModalOpen(false);
    }
  }, [isKycRequired]);

  return { isKycRequired, kycStatus, isKycModalOpen, setKycModalOpen };
};
