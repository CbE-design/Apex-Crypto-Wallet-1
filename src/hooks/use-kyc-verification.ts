'use client';

import { useState } from 'react';
import { useUser } from '@/firebase/firestore/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/firebase/firestore/use-memo-firebase';
import { doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import type { KYCStatus, UserProfile } from '@/lib/types';

export const useKycVerification = () => {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isKycModalOpen, setKycModalOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  // null means "not yet determined" — prevents flash of wrong state.
  // Once auth AND the profile snapshot have both settled we know the real status.
  // Settled when: auth resolved AND (no user OR profile doc has returned at least once).
  const isSettled = !isUserLoading && (!user || !isProfileLoading);
  const kycStatus: KYCStatus | null = isSettled
    ? (userData?.kycStatus || 'NOT_SUBMITTED')
    : null;

  const isKycRequired =
    isSettled &&
    !!user &&
    (kycStatus === 'NOT_SUBMITTED' || kycStatus === 'REJECTED');

  return { isKycRequired, kycStatus, isKycModalOpen, setKycModalOpen };
};
