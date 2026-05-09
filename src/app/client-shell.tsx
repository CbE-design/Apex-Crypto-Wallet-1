'use client';

import type { ReactNode } from 'react';
import { ClientProviders } from './client-providers';

/**
 * Shell component that wraps the application in its required client-side context providers.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  // We removed the mounting guard here because returning 'null' for the 
  // entire children tree causes a hydration mismatch with server-rendered content.
  // Instead, mounting guards are handled within specific providers or components.
  return <ClientProviders>{children}</ClientProviders>;
}
