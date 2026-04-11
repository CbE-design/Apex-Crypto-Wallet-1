
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { marketCoins as staticMarketCoins } from "@/lib/data";
import { CryptoIcon } from "../crypto-icon";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, TrendingUp, AlertTriangle } from "lucide-react";
import { useCurrency } from "@/context/currency-context";
import type { MarketCoin } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { useLivePrices } from '@/hooks/use-live-prices';

const marketSymbols = staticMarketCoins.map(c => c.symbol);

export function MarketOverview() {
  const { currency, formatCurrency } = useCurrency();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { prices, changes, isLoading, error } = useLivePrices(marketSymbols);

  useEffect(() => {
    if (!isLoading && !error) {
      setLastUpdated(new Date());
    }
  }, [isLoading, error]);


  const marketData: MarketCoin[] = useMemo(() => {
      return staticMarketCoins.map(coin => {
        const livePrice = prices[coin.symbol];
        const liveChange = changes[coin.symbol];
        
        // The API returns prices in USD, so we need to convert to the selected currency
        const priceInSelectedCurrency = (livePrice ?? coin.priceUSD) * currency.rate;

        return {
          ...coin,
          priceUSD: priceInSelectedCurrency,
          change24h: liveChange ?? coin.change24h,
        }
      });
  }, [prices, changes, currency.rate]);

  const renderSkeleton = () =>
    [...Array(6)].map((_, i) => (
      <TableRow key={i}>
        <TableCell>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="h-5 w-12 mb-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
      </TableRow>
    ));

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            Market Overview
          </CardTitle>
          <CardDescription className={cn(error && 'text-destructive')}>
            {error
              ? 'Price update failed'
              : lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Live prices from global markets'}
          </CardDescription>
        </div>
        {error && (
            <div className="p-2 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className="max-h-96 overflow-auto scroll-container">
          <Table>
            <TableHeader className="sticky top-0 bg-card/70 backdrop-blur-sm">
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Price ({currency.symbol})</TableHead>
                <TableHead className="text-right">24h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && marketData.every(c => c.priceUSD === 0) ? renderSkeleton() : marketData.map((coin) => (
                <TableRow key={coin.symbol} className="hover:bg-white/5 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CryptoIcon name={coin.name} className="h-8 w-8" />
                      <div>
                        <div className="font-semibold text-base">{coin.symbol}</div>
                        <div className="text-sm text-muted-foreground">{coin.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold tabular-nums", error && 'text-muted-foreground/70')}>
                    {formatCurrency(coin.priceUSD)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "inline-flex items-center justify-end gap-1 text-sm font-semibold",
                      error ? 'text-muted-foreground/70' : coin.change24h >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {coin.change24h >= 0
                        ? <ArrowUp className="h-3 w-3" />
                        : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(coin.change24h ?? 0).toFixed(2)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
