
'use client';

import * as React from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { portfolioAssets as staticAssets, marketCoins } from '@/lib/data';
import { CryptoIcon } from '../crypto-icon';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/currency-context';
import type { PortfolioAsset } from '@/lib/types';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { useLivePrices } from '@/hooks/use-live-prices';

const allKnownCoins = [...staticAssets, ...marketCoins].reduce<Array<{ symbol: string; name: string }>>((acc, c) => {
  if (!acc.find(x => x.symbol === c.symbol)) acc.push({ symbol: c.symbol, name: c.name });
  return acc;
}, []);

const CHART_COLORS = ['#3B8EF3', '#16C780', '#9945FF', '#F7931A', '#F0B90B', '#EF4444', '#00AAE4', '#2A5ADA'];

const chartConfig = {
  value: { label: 'Value' },
  ...Object.fromEntries(
    allKnownCoins.map((asset, index) => [
      asset.symbol.toLowerCase(),
      { label: asset.name, color: CHART_COLORS[index % CHART_COLORS.length] },
    ])
  ),
};

export function PortfolioOverview() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { currency, formatCurrency } = useCurrency();

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);

  const { data: walletData, isLoading: isWalletLoading } = useCollection<{ balance: number; currency: string }>(walletsQuery);

  const portfolioSymbols = React.useMemo(() => {
    if (!walletData) return [];
    return walletData.map(w => w.currency);
  }, [walletData]);

  const { prices, changes, isLoading: isPriceLoading, error: priceError } = useLivePrices(portfolioSymbols);

  const portfolioAssets: PortfolioAsset[] = React.useMemo(() => {
    if (!walletData) return [];
    return walletData.map(walletDoc => {
      const livePriceUSD = prices[walletDoc.currency];
      const staticAssetData = staticAssets.find(sa => sa.symbol === walletDoc.currency);
      const marketData = marketCoins.find(m => m.symbol === walletDoc.currency);
      const priceUSD = livePriceUSD !== undefined ? livePriceUSD : (staticAssetData?.priceUSD || marketData?.priceUSD || 0);
      const change24h = changes[walletDoc.currency] ?? staticAssetData?.change24h ?? marketData?.change24h ?? 0;
      return {
        symbol: walletDoc.currency,
        name: staticAssetData?.name || marketData?.name || walletDoc.currency,
        amount: walletDoc.balance,
        valueUSD: walletDoc.balance * priceUSD,
        priceUSD,
        change24h,
        icon: staticAssetData?.icon || marketData?.icon || '',
      };
    }).filter(Boolean) as PortfolioAsset[];
  }, [walletData, prices, changes]);

  const totalBalance = portfolioAssets.reduce((acc, asset) => acc + asset.valueUSD, 0);
  const totalBalanceInSelectedCurrency = totalBalance * currency.rate;

  const chartData = portfolioAssets
    .filter(asset => asset.valueUSD > 0.01)
    .map((asset, i) => ({
      name: asset.symbol,
      value: asset.valueUSD,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));

  const isLoading = isWalletLoading || (isPriceLoading && Object.keys(prices).length === 0);

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card/60 backdrop-blur-sm p-5">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#3B8EF3] to-[#16C780]" />
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Skeleton className="h-48 w-48 rounded-full shrink-0" />
          <div className="flex-1 space-y-3 w-full">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card/60 backdrop-blur-sm p-5 h-full">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#3B8EF3] to-[#16C780]" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Portfolio Overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Live balances across all assets</p>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold',
          priceError
            ? 'bg-destructive/10 border-destructive/20 text-destructive'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        )}>
          <div className={cn('h-1.5 w-1.5 rounded-full', priceError ? 'bg-destructive' : 'bg-emerald-400 animate-pulse')} />
          {priceError ? 'OFFLINE' : 'LIVE'}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Donut chart */}
        <div className="relative shrink-0">
          {totalBalance > 0 ? (
            <ChartContainer config={chartConfig} className="h-48 w-48">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => {
                      const asset = portfolioAssets.find(a => a.symbol === name);
                      if (!asset) return null;
                      return (
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span className="font-semibold">{asset.name}</span>
                          <span className="font-bold text-emerald-400">{formatCurrency(asset.valueUSD * currency.rate)}</span>
                        </div>
                      );
                    }}
                  />}
                />
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="88%" strokeWidth={0} paddingAngle={3}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} className="hover:opacity-75 transition-opacity" />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="h-48 w-48 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
              <span className="text-xs text-muted-foreground text-center px-4">Awaiting deposit</span>
            </div>
          )}
          {totalBalance > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-1">Net Worth</p>
              <p className={cn('text-xl font-bold tracking-tight', priceError ? 'text-muted-foreground' : 'text-foreground')}>
                {formatCurrency(totalBalanceInSelectedCurrency).split('.')[0]}
              </p>
              <p className="text-[10px] text-muted-foreground">
                .{formatCurrency(totalBalanceInSelectedCurrency).split('.')[1] ?? '00'}
              </p>
            </div>
          )}
        </div>

        {/* Asset list */}
        <div className="flex-1 w-full space-y-1 min-w-0">
          {portfolioAssets.length > 0
            ? portfolioAssets
                .sort((a, b) => b.valueUSD - a.valueUSD)
                .map((asset, i) => (
                  <div key={asset.symbol} className="flex items-center justify-between group cursor-pointer px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-0.5 h-7 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <CryptoIcon name={asset.name} className="h-7 w-7" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{asset.symbol}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {(asset.amount ?? 0).toFixed(asset.symbol === 'BTC' ? 6 : 4)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-semibold', priceError && 'text-muted-foreground/70')}>
                        {formatCurrency(asset.valueUSD * currency.rate)}
                      </p>
                      <div className={cn(
                        'flex items-center justify-end gap-0.5 text-[11px] font-medium',
                        priceError ? 'text-muted-foreground/50' : (asset.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        <TrendingUp className={cn('h-2.5 w-2.5', (asset.change24h ?? 0) < 0 && 'rotate-180')} />
                        {Math.abs(asset.change24h ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))
            : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                <AlertTriangle className="h-6 w-6 opacity-30" />
                No holdings yet
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
