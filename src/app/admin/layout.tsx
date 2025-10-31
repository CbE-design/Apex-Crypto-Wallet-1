
'use client';

import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Header } from '@/components/header';
import { AdminRoute } from '@/components/admin/admin-route';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminRoute>
        <SidebarProvider>
            <div className="flex h-full bg-transparent">
                <Sidebar>
                    <AdminSidebar />
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
    </AdminRoute>
  );
}
