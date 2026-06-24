import { ClientShell } from '../client-shell';
import { Suspense } from 'react';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <ClientShell>
        {children}
      </ClientShell>
    </Suspense>
  );
}
