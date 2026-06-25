'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';
import { useWallet } from '@/context/wallet-context';
import { ShieldAlert, Power, Code } from 'lucide-react';
import { AllSeeingEye } from '@/components/loading-spinner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EyeWatermark } from '@/components/eye-watermark';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type ProtocolStatus } from '@/lib/types';
import { useState, useEffect } from 'react';

export default function AppContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const { isAdmin, loading, user } = useWallet();
  const firestore = useFirestore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const protocolSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'protocol_settings', 'status');
  }, [firestore]);

  const { data: protocolStatus } = useDoc<ProtocolStatus>(protocolSettingsRef);
  const isProtocolHalted = protocolStatus && protocolStatus.isActive === false;

  const isPublicPage = !pathname ||
                       pathname === '/login' ||
                       pathname.startsWith('/login/') ||
                       pathname.startsWith('/legal') ||
                       pathname === '/coming-soon';

  if (loading && !isPublicPage) {
    return (
      <div className="flex items-center justify-center h-[100dvh] w-full bg-background z-[9999] fixed inset-0">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <svg className="animate-spin absolute inset-0 w-20 h-20" viewBox="0 0 80 80" fill="none">
              <defs>
                <linearGradient id="auth-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B8EF3" />
                  <stop offset="75%" stopColor="#16C780" />
                  <stop offset="100%" stopColor="#3B8EF3" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="40" r="36" stroke="url(#auth-ring-grad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="188" strokeDashoffset="47" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <AllSeeingEye size={44} className="animate-pulse" />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground animate-pulse uppercase tracking-[0.2em]">Authenticating Identity...</p>
        </div>
      </div>
    );
  }

  if (isMounted && isProtocolHalted && !isAdmin && !isPublicPage) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-center p-6">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-destructive/20 blur-3xl rounded-full animate-pulse" />
          <div className="relative p-6 bg-destructive/10 rounded-full border-4 border-destructive/30">
            <ShieldAlert className="h-20 w-20 text-destructive" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Scheduled Maintenance</h1>
        <p className="text-base text-muted-foreground mb-2 max-w-md">
          Apex Wallet is temporarily offline while we perform scheduled maintenance.
        </p>
        <p className="text-sm text-muted-foreground mb-8 max-w-md">
          Your funds and account are safe. Please check back shortly — we apologise for the inconvenience.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 mb-8 bg-destructive/5 border border-destructive/20 rounded-xl">
          <Power className="h-4 w-4 text-destructive animate-pulse" />
          <span className="text-xs font-semibold text-destructive uppercase tracking-widest">System Status: Maintenance Mode</span>
        </div>
        <Button asChild variant="outline" size="lg" className="gap-2">
          <Link href="/login?admin=true">
            <Code className="h-4 w-4" />
            Developer Login
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground mt-4 max-w-xs">
          Authorised developers can sign in to continue maintenance work.
        </p>
      </div>
    );
  }

  if (isPublicPage) {
    return <div className="h-[100dvh] w-full overflow-y-auto bg-background">{children}</div>;
  }

  const isAdminPage = pathname.startsWith('/admin');

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="locked-viewport bg-background">
        <div className="fixed-border border-b shadow-sm">
          <Header />
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          <div className="hidden md:block">
            <Sidebar collapsible="icon" className="border-r border-white/5">
              {isAdminPage ? <AdminSidebar /> : <AppSidebar />}
            </Sidebar>
          </div>

          <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden bg-transparent">
            <main className="flex-1 overflow-y-auto overflow-x-hidden aurora-bg p-4 md:p-6 lg:p-8 scroll-smooth flex flex-col relative">
              {/* All-seeing eye — centered, more present */}
              <EyeWatermark
                className="absolute inset-0 m-auto w-[640px] h-[640px] text-primary pointer-events-none"
                opacity={0.048}
              />
              <div className="max-w-7xl mx-auto w-full pb-28 md:pb-10 flex-1 flex flex-col relative z-10">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>

        {!isAdminPage && (
          <div className="fixed-border border-t md:hidden shadow-sm safe-bottom">
            <MobileNav />
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
