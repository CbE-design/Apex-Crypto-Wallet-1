
'use client';

import { useState, useEffect, useMemo } from 'react';
import { marketCoins as staticMarketCoins } from '@/lib/data';
import { CryptoIcon } from '../crypto-icon';
import { cn, formatAppTimeShort } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/context/currency-context';
import type { MarketCoin } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { useLivePrices } from '@/hooks/use-live-prices';

const marketSymbols = staticMarketCoins.map(c => c.symbol);

function MiniSparkline({ positive }: { positive: boolean }) {
  const up = [[0, 22], [8, 16], [16, 18], [24, 9], [32, 12], [40, 5], [48, 7], [56, 2]];
  const dn = [[0, 4], [8, 9], [16, 7], [24, 14], [32, 11], [40, 18], [48, 15], [56, 21]];
  const pts = positive ? up : dn;
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  return (
    <svg width={56} height={24} viewBox="0 0 56 24" className="opacity-80">
      <path d={path} fill="none" stroke={positive ? '#16C780' : '#EF4444'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MarketOverview() {
  const { currency, formatCurrency } = useCurrency();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { prices, changes, isLoading, error } = useLivePrices(marketSymbols);

  useEffect(() => {
    if (!isLoading && !error) setLastUpdated(new Date());
  }, [isLoading, error]);

  const marketData: MarketCoin[] = useMemo(() => {
    return staticMarketCoins.map(coin => {
      const livePrice = prices[coin.symbol];
      const liveChange = changes[coin.symbol];
      const priceInSelectedCurrency = (livePrice ?? coin.priceUSD) * currency.rate;
      return { ...coin, priceUSD: priceInSelectedCurrency, change24h: liveChange ?? coin.change24h };
    });
  }, [prices, changes, currency.rate]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card/60 backdrop-blur-sm p-5 h-full">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#9945FF] to-[#3B8EF3]" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Market</h3>
          <p className={cn('text-xs mt-0.5', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error ? 'Price update failed' : lastUpdated ? `Updated ${formatAppTimeShort(lastUpdated)}` : 'Live from global markets'}
          </p>
        </div>
        {error && (
          <div className="p-2 bg-destructive/10 rounded-full">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_56px] gap-3 pb-2 mb-1 border-b border-white/[0.06]">
        {['Asset', 'Price', '24h', ''].map(h => (
          <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 last:text-right">{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="overflow-y-auto max-h-[420px] scroll-container space-y-0.5 -mx-1 px-1">
        {isLoading && marketData.every(c => c.priceUSD === 0)
          ? [...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_56px] gap-3 items-center py-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <div />
            </div>
          ))
          : marketData.map((coin) => (
            <div key={coin.symbol} className="grid grid-cols-[1fr_auto_auto_56px] gap-3 items-center py-2 px-2 rounded-xl hover:bg-white/[0.04] transition-colors group cursor-pointer border border-transparent hover:border-white/[0.06]">
              <div className="flex items-center gap-2.5 min-w-0">
                <CryptoIcon name={coin.name} className="h-8 w-8 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{coin.symbol}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{coin.name}</p>
                </div>
              </div>
              <p className={cn('text-sm font-semibold tabular-nums text-right', error && 'text-muted-foreground/60')}>
                {formatCurrency(coin.priceUSD)}
              </p>
              <span className={cn(
                'text-sm font-bold text-right tabular-nums',
                error ? 'text-muted-foreground/60' : coin.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {coin.change24h >= 0 ? '+' : ''}{(coin.change24h ?? 0).toFixed(2)}%
              </span>
              <div className="flex justify-end">
                <MiniSparkline positive={coin.change24h >= 0} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
