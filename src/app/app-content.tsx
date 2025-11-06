
'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

export default function AppContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isPublicPage = pathname === '/login';

  if (isPublicPage) {
    return <>{children}</>;
  }

  // The admin layout is now handled by src/app/admin/layout.tsx
  // This component will wrap all pages, including admin pages.
  const isAdminPage = pathname.startsWith('/admin');

  return (
     <SidebarProvider>
        <div className="flex h-full bg-transparent">
            {isAdminPage ? null : (
                <Sidebar>
                    <AppSidebar />
                </Sidebar>
            )}
            <SidebarInset>
            <div className="flex flex-col h-full">
                {!isAdminPage && <Header />}
                <main className={`flex-1 overflow-y-auto ${!isAdminPage ? 'p-4 md:p-6 lg:p-8 aurora-bg' : ''}`}>
                    {children}
                </main>
            </div>
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
