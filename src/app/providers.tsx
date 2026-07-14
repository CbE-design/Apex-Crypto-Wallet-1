'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { WalletProvider } from '@/context/wallet-context';
import { FirebaseProvider } from '@/firebase';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseProvider>
      <WalletProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </WalletProvider>
    </FirebaseProvider>
  );
}
