
'use client';
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
import { marketCoins } from "@/lib/data"
import { CryptoIcon } from "../crypto-icon"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp } from "lucide-react"
import { useCurrency } from "@/context/currency-context"

export function MarketOverview() {
  const { currency, formatCurrency, rates } = useCurrency();

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
              {marketCoins.map((coin) => {
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
                    <TableCell className="text-right font-mono font-semibold">{formatCurrency(priceInSelectedCurrency)}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "flex items-center justify-end gap-1 text-sm font-mono font-semibold",
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
