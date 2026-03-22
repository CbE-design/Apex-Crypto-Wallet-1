'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const ClientProviders = dynamic(
  () => import('./client-providers').then(m => ({ default: m.ClientProviders })),
  { ssr: false }
);

export function ClientShell({ children }: { children: ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
