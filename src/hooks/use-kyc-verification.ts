'use client';

import { useState } from 'react';
import { useUser } from '@/firebase/firestore/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/firebase/firestore/use-memo-firebase';
import { doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import type { KYCStatus, UserProfile } from '@/lib/types';

export const useKycVerification = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isKycModalOpen, setKycModalOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const kycStatus: KYCStatus = userData?.kycStatus || 'NOT_SUBMITTED';

  const isKycRequired = !!user && !isProfileLoading && (kycStatus === 'NOT_SUBMITTED' || kycStatus === 'REJECTED');

  return { isKycRequired, kycStatus, isKycModalOpen, setKycModalOpen };
};
