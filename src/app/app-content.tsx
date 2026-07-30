'use client';

import { usePathname, useRouter } from 'next/navigation';
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
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { type ProtocolStatus } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';

export default function AppContent({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, loading, wallet, vaultLocked, pendingVaultSetup, userProfile } = useWallet();
  const firestore = useFirestore();

  useEffect(() => { setIsMounted(true); }, []);

  // Track user presence: heartbeat every 60s and cleanup on unload.
  // Use setDoc({ merge: true }) so the doc is created if it does not yet exist.
  const updatePresence = useCallback(async (online: boolean) => {
    if (!firestore || !user) return;
    try {
      await setDoc(doc(firestore, 'users', user.uid), {
        lastSeen: serverTimestamp(),
        isOnline: online,
      }, { merge: true });
    } catch (e) {
      console.error('[Presence] Update failed:', e);
    }
  }, [firestore, user]);

  useEffect(() => {
    if (!user) return;
    updatePresence(true);
    const heartbeat = setInterval(() => updatePresence(true), 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updatePresence(true);
    };
    const handleBeforeUnload = () => {
      // Best-effort offline marker; may not always fire before tab closes.
      updatePresence(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence(false);
    };
  }, [user, updatePresence]);

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

  const isAdminPage = !!pathname && pathname.startsWith('/admin');
  const isRestricted = userProfile?.isRestricted === true;
  const walletReady = !!wallet && !vaultLocked && !pendingVaultSetup;
  // Access matches the inner route guards: AdminRoute needs an admin user,
  // PrivateRoute needs an unlocked, non-restricted wallet.
  const accessGranted = isAdminPage
    ? (!!user && isAdmin)
    : (!!user && walletReady && !isRestricted);

  // Perform the redirect ourselves once auth has resolved and access is denied.
  // Previously the inner route guards did this, but they never mounted while the
  // full-screen loader was up — so an unauthenticated visitor spun forever.
  useEffect(() => {
    if (isPublicPage || loading || accessGranted) return;
    router.replace('/login');
  }, [isPublicPage, loading, accessGranted, router]);

  // Keep the full-screen auth loader up on protected pages until the visitor is
  // actually authenticated and ready. This prevents the dashboard chrome from
  // flashing (the "spin into the dashboard then bounce back to login" glitch)
  // while the redirect above runs.
  if (!isPublicPage && (loading || !accessGranted)) {
    return (
      <div className="flex items-center justify-center h-[100dvh] w-full bg-background z-[9999] fixed inset-0">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <svg className="animate-spin absolute inset-0 w-20 h-20" viewBox="0 0 80 80" fill="none">
              <defs>
                <linearGradient id="auth-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="60%" stopColor="#06B6D4" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="40" r="36" stroke="url(#auth-ring-grad)" strokeWidth="2.5"
                strokeLinecap="round" strokeDasharray="188" strokeDashoffset="47" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <AllSeeingEye size={40} className="animate-pulse text-violet-400" />
            </div>
          </div>
          <p className="text-[11px] font-semibold text-white/30 animate-pulse uppercase tracking-[0.25em]">
            Authenticating...
          </p>
        </div>
      </div>
    );
  }

  /*
  if (isMounted && isProtocolHalted && !isAdmin && !isPublicPage) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-center p-6">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full animate-pulse" />
          <div className="relative p-6 bg-red-500/5 rounded-full border border-red-500/20">
            <ShieldAlert className="h-16 w-16 text-red-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3 text-white">Scheduled Maintenance</h1>
        <p className="text-sm text-white/40 mb-8 max-w-sm leading-relaxed">
          Apex Private Ledger is temporarily offline. Your funds are safe. Please check back shortly.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 mb-8 bg-red-500/5 border border-red-500/15 rounded-xl">
          <Power className="h-3.5 w-3.5 text-red-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-red-400 uppercase tracking-widest">Maintenance Mode</span>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 border-violet-500/20 text-violet-400 hover:bg-violet-500/5">
          <Link href="/login?admin=true">
            <Code className="h-3.5 w-3.5" />Developer Login
          </Link>
        </Button>
      </div>
    );
  }
  */

  if (isPublicPage) {
    return <div className="h-[100dvh] w-full overflow-y-auto bg-background">{children}</div>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="locked-viewport bg-background">
        <div className="fixed-border border-b border-white/[0.05] shadow-sm">
          <Header />
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          <div className="hidden md:block">
            <Sidebar collapsible="icon" className="border-r border-white/[0.05]">
              {isAdminPage ? <AdminSidebar /> : <AppSidebar />}
            </Sidebar>
          </div>

          <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden bg-transparent">
            <main className="flex-1 overflow-y-auto overflow-x-hidden aurora-bg p-4 md:p-5 lg:p-6 scroll-smooth flex flex-col relative">
              {/* Eye watermark — faint centered */}
              <EyeWatermark
                className="absolute inset-0 m-auto w-[600px] h-[600px] text-violet-500 pointer-events-none"
                opacity={0.025}
              />
              <div className="max-w-7xl mx-auto w-full pb-28 md:pb-8 flex-1 flex flex-col relative z-10">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>

        {!isAdminPage && (
          <div className="fixed-border border-t border-white/[0.05] md:hidden shadow-sm safe-bottom">
            <MobileNav />
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
