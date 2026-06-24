import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginClient from './login-client';

export const metadata: Metadata = {
  title: 'Login — Apex Wallet',
  description: 'Securely sign in to Apex Wallet to access your self-custodial crypto wallet and compliance documents.',
  alternates: {
    canonical: '/login',
  },
  openGraph: {
    title: 'Login — Apex Wallet',
    description: 'Securely sign in to Apex Wallet to access your self-custodial crypto wallet and compliance documents.',
    url: '/login',
    type: 'website',
  },
  twitter: {
    title: 'Login — Apex Wallet',
    description: 'Securely sign in to Apex Wallet to access your self-custodial crypto wallet and compliance documents.',
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
