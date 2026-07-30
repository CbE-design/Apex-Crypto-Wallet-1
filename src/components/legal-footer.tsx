import Link from 'next/link';
import { Shield, ExternalLink } from 'lucide-react';

export function LegalFooter() {
  return (
    <footer className="mt-auto pt-10 pb-4">
      <div className="border-t border-white/[0.06] pt-6 space-y-4">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <Shield className="h-3.5 w-3.5 text-amber-400/70 shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            <span className="font-semibold text-amber-400/80">Risk Warning:</span> Cryptocurrency values are highly volatile and speculative. You may lose some or all of your assets. Past performance is not indicative of future results. This app does not provide financial, investment, legal, or tax advice. Please read our{' '}
            <Link href="/legal/risk-disclosure" className="underline text-primary/70 hover:text-primary transition-colors">Risk Disclosure</Link> before transacting.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Terms of Service', href: '/legal/terms' },
            { label: 'Privacy Policy', href: '/legal/privacy' },
            { label: 'Risk Disclosure', href: '/legal/risk-disclosure' },
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
            © {new Date().getFullYear()} Apex Private Ledger. All rights reserved.
          </p>
          <p className="text-[9px] text-muted-foreground/30 max-w-xl mx-auto leading-relaxed">
  Apex Private Ledger is a non-custodial software application. It is a self-hosted tool that lets you generate and manage your own keys on your own device. Apex Private Ledger does not hold, control, or have access to your funds, does not act as a financial institution, exchange, broker, or money services business, and does not require licensing or regulatory registration. You are solely responsible for your keys, assets, and transactions.
</p>
        </div>
      </div>
    </footer>
  );
}
