'use client';

import type { ReactNode } from 'react';
import { useLivePrices } from '@/hooks/use-live-prices';
import { useCurrency } from '@/context/currency-context';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { marketCoins } from '@/lib/data';

const marketSymbols = marketCoins.map(c => c.symbol);

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  positive: boolean | null;
  icon: ReactNode;
  accentColor: string;
  glowColor: string;
}

function KpiCard({ label, value, sub, positive, icon, accentColor, glowColor }: KpiCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border bg-[#0A0C12]/80 backdrop-blur-sm p-4 transition-all duration-200",
      "hover:border-opacity-60 group"
    )} style={{ borderColor: `${accentColor}20` }}>
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
      {/* Corner glow */}
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`, opacity: 0.15 }} />

      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">{label}</span>
        <span style={{ color: accentColor }} className="opacity-60 group-hover:opacity-100 transition-opacity">{icon}</span>
      </div>
      <div className="text-[22px] font-bold tracking-tight text-white mb-1.5 font-mono">{value}</div>
      <div className={cn(
        'text-[11px] font-semibold flex items-center gap-1',
        positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-white/25'
      )}>
        {positive === true && <TrendingUp className="h-3 w-3" />}
        {positive === false && <TrendingDown className="h-3 w-3" />}
        {sub}
      </div>
    </div>
  );
}

export function KpiStrip() {
  const { formatCurrency } = useCurrency();
  const { prices, changes, isLoading } = useLivePrices(marketSymbols);

  const btcPrice = prices['BTC'] ?? 0;
  const ethPrice = prices['ETH'] ?? 0;
  const solPrice = prices['SOL'] ?? 0;
  const btcChange = changes['BTC'] ?? 0;
  const ethChange = changes['ETH'] ?? 0;
  const solChange = changes['SOL'] ?? 0;

  const fmt = (usd: number) => isLoading && usd === 0 ? '—' : formatCurrency(usd);
  const pct = (c: number) => `${c >= 0 ? '+' : ''}${c.toFixed(2)}% 24h`;

  const allChanges = Object.values(changes);
  const bullishCount = allChanges.filter(c => c >= 0).length;
  const isBullish = allChanges.length > 0 ? bullishCount >= allChanges.length / 2 : null;
  const totalTracked = allChanges.length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Bitcoin"
        value={fmt(btcPrice)}
        sub={pct(btcChange)}
        positive={btcChange >= 0}
        icon={<Activity className="h-4 w-4" />}
        accentColor="#F7931A"
        glowColor="#F7931A"
      />
      <KpiCard
        label="Ethereum"
        value={fmt(ethPrice)}
        sub={pct(ethChange)}
        positive={ethChange >= 0}
        icon={<Activity className="h-4 w-4" />}
        accentColor="#627EEA"
        glowColor="#627EEA"
      />
      <KpiCard
        label="Solana"
        value={fmt(solPrice)}
        sub={pct(solChange)}
        positive={solChange >= 0}
        icon={<Zap className="h-4 w-4" />}
        accentColor="#9945FF"
        glowColor="#9945FF"
      />
      <KpiCard
        label="Market Trend"
        value={isBullish === null ? '...' : isBullish ? 'Bullish' : 'Bearish'}
        sub={isLoading ? '...' : `${bullishCount}/${totalTracked} assets up`}
        positive={isBullish}
        icon={<TrendingUp className="h-4 w-4" />}
        accentColor="#7C3AED"
        glowColor="#7C3AED"
      />
    </div>
  );
}
