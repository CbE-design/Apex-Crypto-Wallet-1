import type { Metadata } from 'next';
import { Rocket } from "lucide-react";

export const metadata: Metadata = {
  title: 'Coming Soon — Apex Private Ledger',
  description: 'A new Apex Private Ledger feature is under active development. Stay tuned for updates.',
  alternates: {
    canonical: '/coming-soon',
  },
  openGraph: {
    title: 'Coming Soon — Apex Private Ledger',
    description: 'A new Apex Private Ledger feature is under active development. Stay tuned for updates.',
    url: '/coming-soon',
    type: 'website',
  },
  twitter: {
    title: 'Coming Soon — Apex Private Ledger',
    description: 'A new Apex Private Ledger feature is under active development. Stay tuned for updates.',
  },
};

export default function ComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-primary/10 rounded-full mb-6">
            <Rocket className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-2">Coming Soon!</h1>
        <p className="text-lg text-muted-foreground max-w-md">
            This feature is currently under active development. Please check back later to see what we&#39;ve built!
        </p>
    </div>
  );
}
