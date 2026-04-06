'use client';

import { AdminRoute } from '@/components/admin/admin-route';
import { AdminNotificationListener } from '@/components/admin/admin-notification-listener';
import { AdminErrorBoundary } from '@/components/admin/admin-error-boundary';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminRoute>
      <AdminErrorBoundary>
        <AdminNotificationListener />
        {children}
      </AdminErrorBoundary>
    </AdminRoute>
  );
}
