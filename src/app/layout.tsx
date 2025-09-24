import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn("font-body antialiased h-full", "dark")}>
        <SidebarProvider>
          <div className="flex h-full bg-transparent">
            <Sidebar>
              <AppSidebar />
            </Sidebar>
            <SidebarInset>
              <div className="flex flex-col h-full">
                <Header />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 aurora-bg">
                  {children}
                </main>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
