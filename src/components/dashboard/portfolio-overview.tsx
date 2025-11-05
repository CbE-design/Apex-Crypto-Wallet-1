
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
import { portfolioAssets as staticAssets } from '@/lib/data';
import { CryptoIcon } from '../crypto-icon';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/currency-context';

const chartConfig = {
  value: {
    label: 'Value',
  },
  ...Object.fromEntries(
    staticAssets.map((asset, index) => [
      asset.symbol.toLowerCase(),
      {
        label: asset.name,
        color: `hsl(var(--chart-${index + 1}))`,
      },
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
  
  const { data: walletData, isLoading } = useCollection<{balance: number, currency: string}>(walletsQuery);

  const portfolioAssets = React.useMemo(() => {
    if (!walletData) return [];
    
    return walletData.map(walletDoc => {
      const staticAssetData = staticAssets.find(sa => sa.symbol === walletDoc.currency);
      if (!staticAssetData) return null;
      
      return {
        ...staticAssetData,
        amount: walletDoc.balance,
        valueUSD: walletDoc.balance * staticAssetData.priceUSD,
      };
    }).filter(Boolean) as (typeof staticAssets[0] & {amount: number, valueUSD: number})[];

  }, [walletData]);


  const totalBalance = portfolioAssets.reduce(
    (acc, asset) => acc + asset.valueUSD,
    0
  );
  
  const totalBalanceInSelectedCurrency = totalBalance * currency.rate;

  const chartData = portfolioAssets
    .filter(asset => asset.valueUSD > 0)
    .map((asset) => ({
      name: asset.symbol,
      value: asset.valueUSD,
      fill: `var(--color-${asset.symbol.toLowerCase()})`,
    }));
  
  const balanceDigits = Math.floor(totalBalanceInSelectedCurrency).toString().length;

  if (isLoading) {
    return (
        <Card className="bg-card/50 backdrop-blur-sm">
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
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Portfolio Overview</CardTitle>
        <CardDescription>
          Your current crypto holdings and their values.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-full md:w-1/2 h-72">
          <ChartContainer
            config={chartConfig}
            className="min-h-[200px] w-full h-full"
          >
            {totalBalance > 0 ? (
                 <PieChart>
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent 
                            hideLabel 
                            formatter={(value, name, props) => {
                                const asset = portfolioAssets.find(a => a.symbol === name);
                                if (!asset) return null;
                                return (
                                  <div className="w-full">
                                      <div className="flex items-center justify-between">
                                        <span>{asset.name}</span>
                                        <span className="font-mono font-semibold">{formatCurrency(asset.valueUSD * currency.rate)}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-muted-foreground">
                                         <span></span>
                                         <span className="font-mono text-xs">{asset.amount.toFixed(6)} {asset.symbol}</span>
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
                        innerRadius="60%"
                        strokeWidth={5}
                        paddingAngle={5}
                    >
                        {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                </PieChart>
            ) : (
                <div className="flex justify-center items-center h-full text-muted-foreground">
                   No assets in your portfolio.
                </div>
            )}
          </ChartContainer>
          {totalBalance > 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none space-y-1">
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <p
                className={cn(
                  'font-bold',
                  balanceDigits > 10 ? 'text-xl' : 'text-2xl'
                )}
              >
                {formatCurrency(totalBalanceInSelectedCurrency)}
              </p>
            </div>
          )}
        </div>
        <div className="w-full md:w-1/2 space-y-4">
          {portfolioAssets.length > 0 ? portfolioAssets.map((asset) => (
            <div key={asset.symbol} className="flex items-center">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: `hsl(var(--chart-${
                      Object.keys(chartConfig).indexOf(asset.symbol.toLowerCase())
                    }))`,
                  }}
                />
                <CryptoIcon name={asset.name} className="h-6 w-6" />
                <span className="font-semibold">{asset.name}</span>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold">
                  {formatCurrency(asset.valueUSD * currency.rate)}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                    {asset.amount.toFixed(6)} {asset.symbol}
                </p>
              </div>
            </div>
          )) : (
            <div className="text-center text-muted-foreground">Your portfolio is empty.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
