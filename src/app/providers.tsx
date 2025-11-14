'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { WalletProvider } from '@/context/wallet-context';
import { CurrencyProvider } from '@/context/currency-context';
import { VersionCheck } from '@/components/version-check';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <FirebaseClientProvider>
        <WalletProvider>
          <CurrencyProvider>
            {children}
            <VersionCheck />
          </CurrencyProvider>
        </WalletProvider>
      </FirebaseClientProvider>
    </ThemeProvider>
  );
}
