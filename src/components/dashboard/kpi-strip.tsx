'use client';

import type { ReactNode } from 'react';
import { useLivePrices } from '@/hooks/use-live-prices';
import { useCurrency } from '@/context/currency-context';
import { TrendingUp, TrendingDown, BarChart2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const KPI_SYMBOLS = ['BTC', 'ETH', 'SOL'];

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  positive: boolean | null;
  icon: ReactNode;
  topColor: string;
}

function KpiCard({ label, value, sub, positive, icon, topColor }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card/60 backdrop-blur-sm p-4">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: topColor }} />
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium tracking-wide">{label}</span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground mb-1">{value}</div>
      <div className={cn(
        'text-[11px] font-medium flex items-center gap-1',
        positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-muted-foreground/70'
      )}>
        {positive === true && <TrendingUp className="h-3 w-3" />}
        {positive === false && <TrendingDown className="h-3 w-3" />}
        {sub}
      </div>
    </div>
  );
}

export function KpiStrip() {
  const { currency, formatCurrency } = useCurrency();
  const { prices, changes, isLoading } = useLivePrices(KPI_SYMBOLS);

  const btcPrice = prices['BTC'] ?? 0;
  const ethPrice = prices['ETH'] ?? 0;
  const solPrice = prices['SOL'] ?? 0;
  const btcChange = changes['BTC'] ?? 0;
  const ethChange = changes['ETH'] ?? 0;
  const solChange = changes['SOL'] ?? 0;

  const fmt = (usd: number) => isLoading && usd === 0 ? '—' : formatCurrency(usd * currency.rate);
  const pct = (c: number) => `${c >= 0 ? '+' : ''}${c.toFixed(2)}% today`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        label="Bitcoin"
        value={fmt(btcPrice)}
        sub={pct(btcChange)}
        positive={btcChange >= 0}
        icon={<BarChart2 className="h-4 w-4" />}
        topColor="linear-gradient(90deg, #F7931A, #FFB74D)"
      />
      <KpiCard
        label="Ethereum"
        value={fmt(ethPrice)}
        sub={pct(ethChange)}
        positive={ethChange >= 0}
        icon={<BarChart2 className="h-4 w-4" />}
        topColor="linear-gradient(90deg, #627EEA, #A78BFA)"
      />
      <KpiCard
        label="Solana"
        value={fmt(solPrice)}
        sub={pct(solChange)}
        positive={solChange >= 0}
        icon={<Zap className="h-4 w-4" />}
        topColor="linear-gradient(90deg, #9945FF, #14F195)"
      />
      <KpiCard
        label="Market Trend"
        value={Object.values(changes).filter(c => c >= 0).length > Object.values(changes).filter(c => c < 0).length ? 'Bullish' : 'Bearish'}
        sub={`${Object.values(changes).filter(c => c >= 0).length}/${Object.keys(changes).length} assets up`}
        positive={Object.values(changes).filter(c => c >= 0).length >= Object.values(changes).filter(c => c < 0).length}
        icon={<TrendingUp className="h-4 w-4" />}
        topColor="linear-gradient(90deg, #3B8EF3, #16C780)"
      />
    </div>
  );
}
