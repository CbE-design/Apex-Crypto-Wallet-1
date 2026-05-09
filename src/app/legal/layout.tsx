import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Apex Wallet — Legal</span>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-10 pb-20">
        {children}
      </main>
      <footer className="border-t border-border/40 bg-muted/20 py-8 mt-10">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Apex Wallet. All rights reserved. Registered in South Africa.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/legal/risk-disclosure" className="hover:text-foreground transition-colors">Risk Disclosure</Link>
            <Link href="/legal/aml-policy" className="hover:text-foreground transition-colors">AML & FICA Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
