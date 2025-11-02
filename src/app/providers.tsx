'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { WalletProvider } from '@/context/wallet-context';
import { CurrencyProvider } from '@/context/currency-context';

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
          </CurrencyProvider>
        </WalletProvider>
      </FirebaseClientProvider>
    </ThemeProvider>
  );
}
