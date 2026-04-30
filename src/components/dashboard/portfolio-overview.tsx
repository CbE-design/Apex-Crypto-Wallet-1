
'use client';

import * as React from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { portfolioAssets as staticAssets, marketCoins } from '@/lib/data';
import { CryptoIcon } from '../crypto-icon';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/currency-context';
import type { PortfolioAsset } from '@/lib/types';
import { TrendingUp, Wallet, AlertTriangle } from 'lucide-react';
import { useLivePrices } from '@/hooks/use-live-prices';

const allKnownCoins = [...staticAssets, ...marketCoins].reduce<Array<{ symbol: string; name: string }>>((acc, c) => {
  if (!acc.find(x => x.symbol === c.symbol)) acc.push({ symbol: c.symbol, name: c.name });
  return acc;
}, []);

const chartConfig = {
  value: { label: 'Value' },
  ...Object.fromEntries(
    allKnownCoins.map((asset, index) => [
      asset.symbol.toLowerCase(),
      { label: asset.name, color: `hsl(var(--chart-${(index % 5) + 1}))` },
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
  
  const { data: walletData, isLoading: isWalletLoading } = useCollection<{balance: number, currency: string}>(walletsQuery);

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


  const totalBalance = portfolioAssets.reduce(
    (acc, asset) => acc + asset.valueUSD,
    0
  );
  
  const totalBalanceInSelectedCurrency = totalBalance * currency.rate;

  const chartData = portfolioAssets
    .filter(asset => asset.valueUSD > 0.01)
    .map((asset) => ({
      name: asset.symbol,
      value: asset.valueUSD,
      fill: `var(--color-${asset.symbol.toLowerCase()})`,
    }));

  const isLoading = isWalletLoading || (isPriceLoading && Object.keys(prices).length === 0);

  if (isLoading) {
    return (
        <Card className="bg-card/50 backdrop-blur-sm border-border/60">
            <CardHeader>
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center gap-8">
                <div className="relative w-full md:w-1/2 h-72">
                    <Skeleton className="h-full w-full rounded-full" />
                </div>
                <div className="w-full md:w-1/2 space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center">
                            <Skeleton className="h-6 w-6 mr-2 rounded-full" />
                            <Skeleton className="h-6 w-24" />
                            <div className="ml-auto text-right">
                                <Skeleton className="h-5 w-20 mb-1" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm overflow-hidden relative border-border/60">
      {priceError && (
        <div className="absolute top-4 right-4 z-20">
          <div className="p-2 bg-destructive/10 rounded-full">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
        </div>
      )}
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Wallet className="h-32 w-32" />
      </div>
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
            <div className={cn(
                "h-2 w-2 rounded-full",
                priceError ? "bg-destructive" : "bg-accent animate-pulse"
            )} />
            <CardTitle className="text-xl font-bold">Net Worth</CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          Portfolio overview across all holdings
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-8 relative z-10">
        <div className="relative w-full md:w-1/2 h-72">
          <ChartContainer
            config={chartConfig}
            className="min-h-[200px] w-full h-full aspect-auto"
          >
            {totalBalance > 0 ? (
                 <PieChart>
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent 
                            hideLabel 
                            formatter={(value, name) => {
                                const asset = portfolioAssets.find(a => a.symbol === name);
                                if (!asset) return null;
                                return (
                                  <div className="w-full">
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="font-semibold">{asset.name}</span>
                                        <span className={cn("font-bold", priceError ? "text-destructive" : "text-accent")}>{formatCurrency(asset.valueUSD * currency.rate)}</span>
                                      </div>
                                  </div>
                                )
                            }}
                        />}
                    />
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="75%"
                        outerRadius="90%"
                        strokeWidth={0}
                        paddingAngle={5}
                    >
                        {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
                        ))}
                    </Pie>
                </PieChart>
            ) : (
                <div className="flex justify-center items-center h-full text-muted-foreground text-sm">
                   Awaiting initial deposit...
                </div>
            )}
          </ChartContainer>
          {totalBalance > 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none space-y-0">
              <p className="text-xs font-semibold text-primary mb-1">Total Assets</p>
              <p className={cn("text-4xl font-bold tracking-tight text-foreground", priceError && "text-destructive")}>
                {formatCurrency(totalBalanceInSelectedCurrency).split('.')[0]}
                <span className="text-xl opacity-50">.{formatCurrency(totalBalanceInSelectedCurrency).split('.')[1]}</span>
              </p>
            </div>
          )}
        </div>
        <div className="w-full md:w-1/2 space-y-3">
          {portfolioAssets.length > 0 ? portfolioAssets.sort((a,b) => b.valueUSD - a.valueUSD).map((asset) => (
            <div key={asset.symbol} className="flex items-center group cursor-pointer p-2.5 rounded-xl hover:bg-muted/30 transition-all">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-1 h-8 rounded-full"
                  style={{
                    backgroundColor: `hsl(var(--chart-${
                      (Object.keys(chartConfig).indexOf(asset.symbol.toLowerCase()) % 5) + 1
                    }))`,
                  }}
                />
                <CryptoIcon name={asset.name} className="h-8 w-8 transition-transform group-hover:scale-105" />
                <div>
                    <span className="block font-semibold text-sm">{asset.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{(asset.amount ?? 0).toFixed(asset.symbol === 'BTC' ? 6 : 4)} {asset.symbol}</span>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("font-semibold text-sm", priceError && "text-muted-foreground")}>
                  {formatCurrency(asset.valueUSD * currency.rate)}
                </p>
                <div className={cn(
                    "flex items-center justify-end gap-0.5 text-xs font-medium",
                    priceError ? "text-muted-foreground/80" : (asset.change24h ?? 0) >= 0 ? "text-accent" : "text-red-400"
                )}>
                    <TrendingUp className={cn("h-2.5 w-2.5", (asset.change24h ?? 0) < 0 && "rotate-180")} />
                    {Math.abs(asset.change24h ?? 0).toFixed(2)}%
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center text-muted-foreground text-sm py-8">No holdings yet</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
