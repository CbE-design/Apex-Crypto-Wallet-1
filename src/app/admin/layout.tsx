
'use client';

import { AdminRoute } from '@/components/admin/admin-route';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminRoute>
        {children}
    </AdminRoute>
  );
}
