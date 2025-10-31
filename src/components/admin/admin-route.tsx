
'use client';

import { useWallet } from '@/context/wallet-context';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { wallet, isAdmin, loading } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!wallet) {
        router.push('/login');
      } else if (!isAdmin) {
        router.push('/');
      }
    }
  }, [wallet, isAdmin, loading, router]);

  if (loading || !wallet || !isAdmin) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    )
  }

  return <>{children}</>;
};
