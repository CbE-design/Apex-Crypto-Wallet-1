'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';
import { useWallet } from '@/context/wallet-context';
import { ShieldAlert, Loader2, Power } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function AppContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAdmin } = useWallet();
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore();

  const protocolSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'protocol_settings', 'status');
  }, [firestore]);

  const { data: protocolStatus } = useDoc<{ isHalted: boolean }>(protocolSettingsRef);
  const isProtocolHalted = protocolStatus?.isHalted ?? false;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isPublicPage = pathname === '/login';

  if (isPublicPage) {
    return <div className="h-[100dvh] w-full overflow-y-auto bg-background">{children}</div>;
  }

  const isAdminPage = pathname.startsWith('/admin');

  // Halted State UI: Show an overlay for non-admin users if protocol is cut
  if (isProtocolHalted && !isAdmin) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-center p-6">
          <div className="relative mb-8">
              <div className="absolute inset-0 bg-destructive/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative p-6 bg-destructive/10 rounded-full border-4 border-destructive/30">
                  <ShieldAlert className="h-20 w-20 text-destructive" />
              </div>
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Protocol Halted</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] mb-8 max-w-sm">
              The Apex Private Ledger has been suspended by system governance. Inbound and outbound RPC traffic is currently inhibited.
          </p>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
              <Power className="h-4 w-4 text-destructive animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-destructive">Network State: DISCONNECTED</span>
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
            <main className="flex-1 overflow-y-auto overflow-x-hidden aurora-bg p-4 md:p-6 lg:p-8 scroll-smooth">
              <div className="max-w-7xl mx-auto w-full pb-28 md:pb-10">
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
