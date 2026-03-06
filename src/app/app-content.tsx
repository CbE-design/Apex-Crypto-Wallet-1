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
    return <div className="h-svh w-full overflow-y-auto">{children}</div>;
  }

  const isAdminPage = pathname.startsWith('/admin');

  return (
    <SidebarProvider defaultOpen={true} className="h-svh w-full overflow-hidden flex flex-col">
      <div className="flex flex-col h-svh w-full bg-background overflow-hidden">
        <div className="flex flex-1 overflow-hidden relative">
          {!isAdminPage && (
            <Sidebar collapsible="icon" className="hidden md:flex">
              <AppSidebar />
            </Sidebar>
          )}
          <SidebarInset className="flex flex-col h-full w-full overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto scroll-container aurora-bg p-4 md:p-6 lg:p-8 relative">
              <div className="max-w-7xl mx-auto w-full pb-20 md:pb-0 z-10 relative">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>
        {!isAdminPage && <MobileNav />}
      </div>
    </SidebarProvider>
  );
}
