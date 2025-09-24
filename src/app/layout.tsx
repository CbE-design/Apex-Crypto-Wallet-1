
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/context/auth-context';
import AppContent from './app-content';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Apex Crypto Wallet',
  description: 'A modern cryptocurrency exchange and wallet app.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className={cn("font-body antialiased h-full", "dark")}>
        <AuthProvider>
            <AppContent>
              {children}
            </AppContent>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
