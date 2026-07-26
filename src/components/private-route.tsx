
'use client';

import { useWallet } from '@/context/wallet-context';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { LoadingSpinner } from './loading-spinner';

export const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, wallet, vaultLocked, pendingVaultSetup, userProfile } = useWallet();
  const router = useRouter();

  const isRestricted = userProfile?.isRestricted === true;
  const walletReady = !!wallet && !vaultLocked && !pendingVaultSetup;

  useEffect(() => {
    if (loading) return;
    if (!user || !walletReady || isRestricted) {
      router.push('/login');
    }
  }, [user, loading, walletReady, isRestricted, router]);

  if (loading || !user || !walletReady || isRestricted) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
};
