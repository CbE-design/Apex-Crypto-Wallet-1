
'use client';
import { useState, useEffect } from 'react';
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
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react"
import { useCurrency } from "@/context/currency-context"
import { getLivePrices } from '@/services/crypto-service';
import type { MarketCoin } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export function MarketOverview() {
  const { currency, formatCurrency } = useCurrency();
  const [marketData, setMarketData] = useState<MarketCoin[]>(staticMarketCoins);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMarketData() {
      setIsLoading(true);
      const symbols = staticMarketCoins.map(c => c.symbol);
      try {
        const livePrices = await getLivePrices(symbols, currency.symbol);
        
        const updatedMarketData = staticMarketCoins.map(coin => ({
          ...coin,
          priceUSD: livePrices[coin.symbol] !== undefined ? livePrices[coin.symbol] / currency.rate : coin.priceUSD,
        }));
        
        setMarketData(updatedMarketData);
      } catch (error) {
        console.error("Could not fetch live market data, using static data as fallback.", error);
        // In case of error, marketData will remain as staticMarketCoins
      } finally {
        setIsLoading(false);
      }
    }
    fetchMarketData();
  }, [currency.symbol, currency.rate]);

  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
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
        <TableCell className="text-right">
          <Skeleton className="h-5 w-24 ml-auto" />
        </TableCell>
        <TableCell className="text-right">
          <Skeleton className="h-5 w-16 ml-auto" />
        </TableCell>
      </TableRow>
    ))
  );

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Market Overview</CardTitle>
        <CardDescription>Top cryptocurrencies by market cap.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/70 backdrop-blur-sm">
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? renderSkeleton() : marketData.map((coin) => {
                const priceInSelectedCurrency = coin.priceUSD * currency.rate;
                return (
                  <TableRow key={coin.symbol}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CryptoIcon name={coin.name} className="h-8 w-8" />
                        <div>
                          <div className="font-semibold text-base">{coin.symbol}</div>
                          <div className="text-sm text-muted-foreground">{coin.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(priceInSelectedCurrency)}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "flex items-center justify-end gap-1 text-sm font-semibold",
                        coin.change24h >= 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {coin.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(coin.change24h)}%
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
