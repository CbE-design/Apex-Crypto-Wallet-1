import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginClient from './login-client';

export const metadata: Metadata = {
  title: 'Login — Apex Private Ledger',
  description: 'Securely sign in to Apex Private Ledger to access your self-custody crypto wallet.',
  alternates: {
    canonical: '/login',
  },
  openGraph: {
    title: 'Login — Apex Private Ledger',
    description: 'Securely sign in to Apex Private Ledger to access your self-custody crypto wallet.',
    url: '/login',
    type: 'website',
  },
  twitter: {
    title: 'Login — Apex Private Ledger',
    description: 'Securely sign in to Apex Private Ledger to access your self-custody crypto wallet.',
  },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { admin?: string };
}) {
  const initialAdminMode = searchParams.admin === 'true';

  return (
    <Suspense fallback={null}>
      <LoginClient initialAdminMode={initialAdminMode} />
    </Suspense>
  );
}
