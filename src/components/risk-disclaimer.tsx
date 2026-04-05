'use client';

import { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiskDisclaimerProps {
  variant?: 'trading' | 'withdrawal' | 'transfer' | 'general';
  className?: string;
  collapsible?: boolean;
}

const CONTENT: Record<NonNullable<RiskDisclaimerProps['variant']>, { title: string; body: string }> = {
  trading: {
    title: 'Crypto Trading Risk Disclosure',
    body: 'Swapping or trading cryptocurrency involves significant risk of loss. Digital asset prices are highly volatile and may fluctuate dramatically in short periods. You may lose part or all of the value of your assets. This is not financial advice. Ensure you fully understand the risks before proceeding. Past performance is not a reliable indicator of future results.',
  },
  withdrawal: {
    title: 'Withdrawal & Fiat Conversion Notice',
    body: 'Withdrawals to bank accounts are subject to FICA compliance checks, SARB exchange control regulations, and may require additional verification for transactions above R25,000. Processing times may vary (1–5 business days). Apex Wallet is not responsible for delays caused by banking institutions. Exchange rates are locked at time of quote and are valid for 30 seconds only.',
  },
  transfer: {
    title: 'Crypto Transfer Notice — Travel Rule Compliance',
    body: 'Transfers of crypto assets with a value of R3,000 or more are subject to the FATF Travel Rule. Beneficiary information may be collected and reported to relevant regulatory authorities as required under the Financial Intelligence Centre Act (FICA). Apex Wallet complies with all applicable AML/CFT regulations.',
  },
  general: {
    title: 'General Risk & Regulatory Notice',
    body: 'Crypto assets are unregulated financial instruments. Their value may be affected by market conditions, technology failures, regulatory changes, or other factors outside our control. Apex Wallet is not a licensed financial services provider and does not provide investment advice. All transactions are final and irreversible. By using this service you acknowledge and accept these risks.',
  },
};

export function RiskDisclaimer({ variant = 'general', className, collapsible = false }: RiskDisclaimerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible);
  const content = CONTENT[variant];

  if (dismissed) return null;

  return (
    <div className={cn('rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200/80', className)}>
      <div className="flex items-start gap-2.5 p-3.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-amber-300">{content.title}</p>
            <div className="flex items-center gap-1 shrink-0">
              {collapsible && (
                <button
                  onClick={() => setExpanded(p => !p)}
                  className="h-5 w-5 rounded flex items-center justify-center text-amber-400/60 hover:text-amber-400 transition-colors"
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="h-5 w-5 rounded flex items-center justify-center text-amber-400/60 hover:text-amber-400 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          {expanded && (
            <p className="text-[10px] text-amber-200/60 leading-relaxed mt-1">
              {content.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
