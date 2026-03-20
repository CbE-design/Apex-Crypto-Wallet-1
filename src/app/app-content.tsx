'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';
import { useWallet } from '@/context/wallet-context';
import { ShieldAlert, Loader2, Power } from 'lucide-react';
import { EyeWatermark } from '@/components/eye-watermark';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type ProtocolStatus } from '@/lib/types';

export default function AppContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAdmin, loading, user } = useWallet();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const protocolSettingsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'protocol_settings', 'status');
  }, [firestore, user]);

  const { data: protocolStatus } = useDoc<ProtocolStatus>(protocolSettingsRef);
  const isProtocolHalted = protocolStatus && protocolStatus.isActive === false;

  const isPublicPage = pathname === '/login';

  // Prevent hydration mismatch by returning a stable structure until mounted
  if (!mounted) {
    return <div className="h-[100dvh] w-full bg-background" />;
  }

  if (isPublicPage) {
    return <div className="h-[100dvh] w-full overflow-y-auto bg-background">{children}</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] w-full bg-background z-[9999] fixed inset-0">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground animate-pulse uppercase tracking-[0.2em]">Authenticating Identity...</p>
        </div>
      </div>
    );
  }

  const isAdminPage = pathname.startsWith('/admin');

  // Halted State UI: High-integrity maintenance overlay
  if (isProtocolHalted && !isAdmin) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-center p-6">
          <div className="relative mb-8">
              <div className="absolute inset-0 bg-destructive/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative p-6 bg-destructive/10 rounded-full border-4 border-destructive/30">
                  <ShieldAlert className="h-20 w-20 text-destructive" />
              </div>
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-3">System Reconciling</h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-sm font-bold uppercase tracking-tight">
              Ledger synchronization and asset settlement have been temporarily suspended for verified system orchestration.
          </p>
          <div className="flex items-center gap-2 px-4 py-2 bg-destructive/5 border border-destructive/20 rounded-xl">
              <Power className="h-4 w-4 text-destructive animate-pulse" />
              <span className="text-sm font-black text-destructive uppercase tracking-widest">Protocol State: HALTED</span>
          </div>
      </div>
    );
  }

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
              <EyeWatermark
                className="absolute bottom-0 right-0 w-[560px] h-[560px] text-primary pointer-events-none translate-x-1/4 translate-y-1/4"
                opacity={0.028}
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
