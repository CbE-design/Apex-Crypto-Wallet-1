
'use client';

import { useWallet } from '@/context/wallet-context';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { wallet, isAdmin, loading } = useWallet();
  const router = useRouter();

  useEffect(() => {
    // This effect handles redirection once loading is complete.
    if (!loading) {
      if (!wallet) {
        // If there's no wallet, redirect to login.
        router.push('/login');
      } else if (!isAdmin) {
        // If there is a wallet but the user is not an admin, redirect to the main dashboard.
        router.push('/');
      }
    }
  }, [wallet, isAdmin, loading, router]);

  // The loading spinner should only be shown while the wallet context is loading.
  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  // If loading is complete AND we have a wallet AND the user is an admin, show the children.
  // Otherwise, the useEffect above will have already initiated a redirect, so we can return null.
  if (wallet && isAdmin) {
    return <>{children}</>;
  }

  // Render nothing while the redirect is happening.
  return null;
};
