
'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { marketCoins as staticMarketCoins } from "@/lib/data"
import { CryptoIcon } from "../crypto-icon"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react"
import { useCurrency } from "@/context/currency-context"
import type { MarketCoin } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function MarketOverview() {
  const { currency, formatCurrency } = useCurrency();
  const [marketData, setMarketData] = useState<MarketCoin[]>(staticMarketCoins);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMarketData = async () => {
    const symbols = staticMarketCoins.map(c => c.symbol);
    try {
      const res = await fetch(
        `/api/prices?symbols=${symbols.join(',')}&currency=${currency.symbol}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('price fetch failed');
      const { prices, changes } = await res.json() as {
        prices: Record<string, number>;
        changes: Record<string, number>;
      };

      setMarketData(staticMarketCoins.map(coin => ({
        ...coin,
        priceUSD: prices[coin.symbol] ?? coin.priceUSD * currency.rate,
        change24h: changes[coin.symbol] ?? coin.change24h,
      })));
      setLastUpdated(new Date());
    } catch {
      setMarketData(staticMarketCoins.map(coin => ({
        ...coin,
        priceUSD: coin.priceUSD * currency.rate,
      })));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchMarketData();

    intervalRef.current = setInterval(fetchMarketData, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency.symbol]);

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
          <CardDescription>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Live prices from global markets'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/70 backdrop-blur-sm">
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Price ({currency.symbol})</TableHead>
                <TableHead className="text-right">24h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? renderSkeleton() : marketData.map((coin) => (
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
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(coin.priceUSD)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "inline-flex items-center justify-end gap-1 text-sm font-semibold",
                      coin.change24h >= 0 ? "text-green-400" : "text-red-400"
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
