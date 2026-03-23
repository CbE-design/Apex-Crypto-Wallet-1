'use client';

import { AdminRoute } from '@/components/admin/admin-route';
import { AdminNotificationListener } from '@/components/admin/admin-notification-listener';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminRoute>
        <AdminNotificationListener />
        {children}
    </AdminRoute>
  );
}
