
'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { cn } from '@/lib/utils';
import { useWallet } from '@/context/wallet-context';
import { PrivateRoute } from '@/components/private-route';

export default function AppContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { wallet } = useWallet();

  const isPublicPage = pathname === '/login';
  const isAdminPage = pathname.startsWith('/admin');

  if (isPublicPage) {
    return <>{children}</>;
  }
  
  if (isAdminPage) {
      return <>{children}</>;
  }

  return (
    <PrivateRoute>
        <SidebarProvider>
            <div className="flex h-full bg-transparent">
                <Sidebar>
                <AppSidebar />
                </Sidebar>
                <SidebarInset>
                <div className="flex flex-col h-full">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 aurora-bg">
                    {children}
                    </main>
                </div>
                </SidebarInset>
            </div>
        </SidebarProvider>
    </PrivateRoute>
  );
}
