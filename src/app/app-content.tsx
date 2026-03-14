
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
        {/* Fixed Standalone Top Header Border */}
        <div className="flex-none z-50 border-b bg-background shadow-sm">
          <Header />
        </div>

        {/* Central Section (Independent Area) */}
        <div className="flex flex-1 overflow-hidden">
          {!isAdminPage && (
            <div className="hidden md:block">
              <Sidebar collapsible="icon" className="border-r">
                <AppSidebar />
              </Sidebar>
            </div>
          )}

          <SidebarInset className="flex flex-col h-full w-full overflow-hidden">
            {/* The ONLY scrollable container in the sandwich middle */}
            <main className="flex-1 overflow-y-auto aurora-bg p-4 md:p-6 lg:p-8 relative scroll-smooth">
              <div className="max-w-7xl mx-auto w-full pb-20 md:pb-0">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>

        {/* Fixed Standalone Bottom Nav Border (Mobile Only) */}
        {!isAdminPage && (
          <div className="flex-none md:hidden z-50 border-t bg-background shadow-sm safe-bottom">
            <MobileNav />
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
