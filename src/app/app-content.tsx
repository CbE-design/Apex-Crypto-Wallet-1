'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';
import { cn } from '@/lib/utils';

export default function AppContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicPage = pathname === '/login';

  if (isPublicPage) {
    return <div className="h-svh w-full overflow-y-auto">{children}</div>;
  }

  const isAdminPage = pathname.startsWith('/admin');

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-col h-svh w-full bg-background overflow-hidden">
        {/* Standalone Top Header */}
        <Header />

        <div className="flex flex-1 overflow-hidden relative">
          {/* Desktop Sidebar */}
          {!isAdminPage && (
            <Sidebar collapsible="icon" className="hidden md:flex">
              <AppSidebar />
            </Sidebar>
          )}

          {/* Main Content Sandwich - Scrollable Middle */}
          <SidebarInset className="flex flex-col h-full w-full overflow-hidden">
            <main className="flex-1 overflow-y-auto scroll-container aurora-bg p-4 md:p-6 lg:p-8 relative">
              <div className="max-w-7xl mx-auto w-full pb-20 md:pb-0 z-10 relative">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>

        {/* Standalone Bottom Footer */}
        {!isAdminPage && <MobileNav />}
      </div>
    </SidebarProvider>
  );
}
