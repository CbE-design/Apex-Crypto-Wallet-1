'use client';

import * as React from 'react';
import Link from 'next/link';
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
import { TrendingUp } from 'lucide-react';
import { useLivePrices } from '@/hooks/use-live-prices';
import { Button } from '@/components/ui/button';
import { useLiveApxdBalance } from '@/hooks/use-live-apxd-balance';

const allKnownCoins = [...staticAssets, ...marketCoins].reduce<Array<{ symbol: string; name: string }>>((acc, c) => {
  if (!acc.find(x => x.symbol === c.symbol)) acc.push({ symbol: c.symbol, name: c.name });
  return acc;
}, []);

const CHART_COLORS = ['#7C3AED', '#06B6D4', '#F7931A', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

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
  const { formatCurrency } = useCurrency();

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);

  const { data: walletData, isLoading: isWalletLoading } = useCollection<{ balance: number; currency: string; address?: string }>(walletsQuery);
  const apxdAddress = React.useMemo(
    () => walletData?.find(walletDoc => walletDoc.currency.toUpperCase() === 'APXD')?.address,
    [walletData],
  );
  const { balance: liveApxdBalance } = useLiveApxdBalance(apxdAddress);

  const portfolioSymbols = React.useMemo(() => {
    if (!walletData) return [];
    return walletData.map(w => w.currency);
  }, [walletData]);

  const { prices, changes, isLoading: isPriceLoading, error: priceError } = useLivePrices(portfolioSymbols);

  const isLoading = isWalletLoading || (isPriceLoading && portfolioSymbols.length > 0);

  const portfolioAssets: PortfolioAsset[] = React.useMemo(() => {
    if (!walletData) return [];
    return walletData.map(walletDoc => {
      const livePriceUSD = prices[walletDoc.currency];
      const staticAssetData = staticAssets.find(sa => sa.symbol === walletDoc.currency);
      const marketData = marketCoins.find(m => m.symbol === walletDoc.currency);
      const priceUSD = livePriceUSD !== undefined ? livePriceUSD : (staticAssetData?.priceUSD || marketData?.priceUSD || 0);
      const change24h = changes[walletDoc.currency] ?? staticAssetData?.change24h ?? marketData?.change24h ?? 0;
      const isApxd = walletDoc.currency.toUpperCase() === 'APXD';
      const amount = isApxd && liveApxdBalance !== null ? liveApxdBalance : walletDoc.balance;
      return {
        symbol: walletDoc.currency,
        name: staticAssetData?.name || marketData?.name || walletDoc.currency,
        amount,
        valueUSD: amount * priceUSD,
        priceUSD,
        change24h,
        icon: staticAssetData?.icon || marketData?.icon || '',
      };
    }).filter(Boolean) as PortfolioAsset[];
  }, [walletData, prices, changes, liveApxdBalance]);

  const totalBalance = portfolioAssets.reduce((acc, asset) => acc + asset.valueUSD, 0);

  const chartData = portfolioAssets
    .filter(asset => asset.valueUSD > 0.01)
    .map((asset, i) => ({
      name: asset.symbol,
      value: asset.valueUSD,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0A0C12]/60 backdrop-blur-sm p-5">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-500 animate-pulse" />
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
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0A0C12]/60 backdrop-blur-sm p-5 h-full">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-500" />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Portfolio Overview</h3>
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
        <div className="relative shrink-0" style={{ width: 192, height: 192 }}>
          {totalBalance > 0 ? (
            <ChartContainer config={chartConfig} style={{ width: 192, height: 192 }}>
              <PieChart width={192} height={192}>
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
                          <span className="font-bold text-emerald-400">{formatCurrency(asset.valueUSD)}</span>
                        </div>
                      );
                    }}
                  />}
                />
                <Pie data={chartData} dataKey="value" nameKey="name" cx={96} cy={96} innerRadius={66} outerRadius={88} strokeWidth={0} paddingAngle={3}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} className="hover:opacity-75 transition-opacity" />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="w-full h-full rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
              <span className="text-xs text-muted-foreground text-center px-4">Awaiting deposit</span>
            </div>
          )}
          {totalBalance > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-1">Net Worth</p>
              <p className={cn('text-xl font-bold tracking-tight', priceError ? 'text-muted-foreground' : 'text-white')}>
                {formatCurrency(totalBalance).split('.')[0]}
              </p>
              <p className="text-[10px] text-muted-foreground">
                .{formatCurrency(totalBalance).split('.')[1] ?? '00'}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 w-full min-w-0">
          {totalBalance > 0 ? (
            <div className="space-y-1">
              {portfolioAssets
                .filter(asset => asset.valueUSD > 0.01)
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
                        {formatCurrency(asset.valueUSD)}
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
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center bg-white/[0.02] rounded-xl p-6">
              <h4 className="text-base font-semibold text-white mb-1">Your portfolio is empty</h4>
              <p className="text-sm text-muted-foreground mb-5">Start by adding funds to your account.</p>
              <Link href="/send-receive" className="w-full">
                <Button size="lg" className="w-full">Receive Assets</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
