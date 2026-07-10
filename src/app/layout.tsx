import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { cn } from '@/lib/utils';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://apexwallet.co.za';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Apex Crypto Wallet',
  description: 'Institutional-grade self-custodial crypto wallet.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/apex-icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    siteName: 'Apex Wallet',
    type: 'website',
    images: ['/apex-icon.png'],
  },
  twitter: {
    card: 'summary',
    images: ['/apex-icon.png'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Apex Wallet',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/apex-icon.png`,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'support@apexwallet.co.za',
        contactType: 'customer support',
      },
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Apex Wallet',
      publisher: {
        '@id': `${SITE_URL}/#organization`,
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('h-full', GeistSans.variable)} suppressHydrationWarning>
      <body className={cn('font-body antialiased h-full', inter.className, spaceGrotesk.className)}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
