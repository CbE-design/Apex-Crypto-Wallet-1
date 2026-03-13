'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';

export default function AppContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicPage = pathname === '/login';

  if (isPublicPage) {
    return <div className="h-[100dvh] w-full overflow-y-auto">{children}</div>;
  }

  const isAdminPage = pathname.startsWith('/admin');

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden">
        {/* Fixed Top Header (Standalone Border) */}
        <div className="flex-none z-50">
          <Header />
        </div>

        {/* Central Section */}
        <div className="flex flex-1 overflow-hidden">
          {!isAdminPage && (
            <Sidebar collapsible="icon" className="hidden md:flex">
              <AppSidebar />
            </Sidebar>
          )}

          <SidebarInset className="flex flex-col h-full w-full overflow-hidden">
            {/* Scrollable Content Section */}
            <main className="flex-1 overflow-y-auto scroll-container aurora-bg p-4 md:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto w-full">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>

        {/* Fixed Bottom Nav (Standalone Border) */}
        {!isAdminPage && (
          <div className="flex-none md:hidden z-50">
            <MobileNav />
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
