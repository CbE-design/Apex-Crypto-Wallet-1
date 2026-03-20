'use client';

import type { ReactNode } from 'react';
import { ClientProviders } from './client-providers';

/**
 * Shell component that wraps the application in its required client-side context providers.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
