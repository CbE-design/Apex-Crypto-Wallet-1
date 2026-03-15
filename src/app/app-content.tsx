
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';
import { useWallet } from '@/context/wallet-context';
import { Loader2 } from 'lucide-react';

export default function AppContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { loading } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by only rendering shell after mount
  if (!mounted) {
    return null;
  }

  const isPublicPage = pathname === '/login';

  if (isPublicPage) {
    return <div className="h-[100dvh] w-full overflow-y-auto bg-background">{children}</div>;
  }

  const isAdminPage = pathname.startsWith('/admin');

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="locked-viewport bg-background">
        {/* Fixed Top Border (Header) */}
        <div className="fixed-border border-b shadow-sm">
          <Header />
        </div>

        {/* Independent Scroll Area (Center) */}
        <div className="flex flex-1 overflow-hidden relative">
          <div className="hidden md:block">
            <Sidebar collapsible="icon" className="border-r border-white/5">
              {isAdminPage ? <AdminSidebar /> : <AppSidebar />}
            </Sidebar>
          </div>

          <SidebarInset className="flex flex-col h-full w-full overflow-hidden bg-transparent">
            <main className="independent-scroll aurora-bg p-4 md:p-6 lg:p-8 relative scroll-smooth">
              <div className="max-w-7xl mx-auto w-full pb-20 md:pb-0">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>

        {/* Fixed Bottom Border (Mobile Navigation) */}
        {!isAdminPage && (
          <div className="fixed-border border-t md:hidden shadow-sm safe-bottom">
            <MobileNav />
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
