
'use client';

import { useWallet } from '@/context/wallet-context';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

export const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { wallet, loading } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !wallet) {
      router.push('/login');
    }
  }, [wallet, loading, router]);

  if (loading || !wallet) {
    // You can return a loading spinner here
    return null;
  }

  return <>{children}</>;
};
