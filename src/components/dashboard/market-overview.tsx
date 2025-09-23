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

export function MarketOverview() {
  const formatMarketCap = (cap: number) => {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`
    return `$${cap.toFixed(2)}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Overview</CardTitle>
        <CardDescription>Top cryptocurrencies by market cap.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Change (24h)</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Market Cap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {marketCoins.map((coin) => (
              <TableRow key={coin.symbol}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CryptoIcon name={coin.name} className="h-6 w-6" />
                    <div>
                      <div className="font-medium">{coin.symbol}</div>
                      <div className="text-xs text-muted-foreground hidden sm:block">{coin.name}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">${coin.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "flex items-center justify-end gap-1 text-sm",
                    coin.change24h >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {coin.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(coin.change24h)}%
                  </span>
                </TableCell>
                <TableCell className="text-right hidden sm:table-cell">{formatMarketCap(coin.marketCap)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
