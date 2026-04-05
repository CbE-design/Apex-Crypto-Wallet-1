import Link from 'next/link';
import { Shield, ExternalLink } from 'lucide-react';

export function LegalFooter() {
  return (
    <footer className="mt-auto pt-10 pb-4">
      <div className="border-t border-white/[0.06] pt-6 space-y-4">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <Shield className="h-3.5 w-3.5 text-amber-400/70 shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            <span className="font-semibold text-amber-400/80">Risk Warning:</span> Cryptocurrency investments are highly volatile and speculative. You may lose some or all of your invested capital. Past performance is not indicative of future results. This platform does not provide financial, investment, legal, or tax advice. Please read our{' '}
            <Link href="/legal/risk-disclosure" className="underline text-primary/70 hover:text-primary transition-colors">Risk Disclosure</Link> before transacting.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Terms of Service', href: '/legal/terms' },
            { label: 'Privacy Policy', href: '/legal/privacy' },
            { label: 'Risk Disclosure', href: '/legal/risk-disclosure' },
            { label: 'AML & FICA Policy', href: '/legal/aml-policy' },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1]"
            >
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              {label}
            </Link>
          ))}
        </div>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground/40">
            © {new Date().getFullYear()} Apex Wallet (Pty) Ltd. All rights reserved.
          </p>
          <p className="text-[9px] text-muted-foreground/30 max-w-xl mx-auto leading-relaxed">
            Apex Wallet operates in compliance with the Financial Intelligence Centre Act (FICA) No. 38 of 2001, the Financial Sector Regulation Act (FSRA), the Protection of Personal Information Act (POPIA), and applicable FATF Travel Rule obligations. Crypto asset services are subject to regulatory oversight by the Financial Sector Conduct Authority (FSCA).
          </p>
        </div>
      </div>
    </footer>
  );
}
