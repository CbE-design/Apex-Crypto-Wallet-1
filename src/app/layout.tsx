
import type {Metadata} from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import { ClientShell } from './client-shell';

export const metadata: Metadata = {
  title: 'Apex Crypto Wallet',
  description: 'Institutional-grade self-custodial crypto wallet.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/apex-icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={cn("font-body antialiased h-full")}>
        <Providers>
          <ClientShell>
            {children}
          </ClientShell>
        </Providers>
      </body>
    </html>
  );
}
