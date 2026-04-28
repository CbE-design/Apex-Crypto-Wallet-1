'use client';

import type { ReactNode } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { WalletProvider } from '@/context/wallet-context';
import { CurrencyProvider } from '@/context/currency-context';
import AppContent from './app-content';
import { Toaster } from '@/components/ui/toaster';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
      <WalletProvider>
        <CurrencyProvider>
          <AppContent>
            {children}
          </AppContent>
          <Toaster />
        </CurrencyProvider>
      </WalletProvider>
    </FirebaseClientProvider>
  );
}
