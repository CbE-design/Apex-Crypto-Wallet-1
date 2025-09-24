"use client"

import * as React from "react"
import { Area, AreaChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { portfolioAssets } from "@/lib/data"
import { CryptoIcon } from "../crypto-icon"
import { cn } from "@/lib/utils"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

const chartData = [
  { month: "January", value: 86250 },
  { month: "February", value: 88000 },
  { month: "March", value: 91500 },
  { month: "April", value: 90000 },
  { month: "May", value: 92500 },
  { month: "June", value: 108500 },
]

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig

export function PortfolioOverview() {
  const totalBalance = portfolioAssets.reduce((acc, asset) => acc + asset.valueUSD, 0);

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Portfolio Overview</CardTitle>
            <CardDescription>Your current crypto holdings and their values.</CardDescription>
          </div>
          <div className="text-4xl font-bold tracking-tighter">
            ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full -ml-4">
          <ChartContainer config={chartConfig}>
            <AreaChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <Area
                dataKey="value"
                type="natural"
                fill="url(#chart-fill)"
                fillOpacity={0.4}
                stroke="var(--color-value)"
                stackId="a"
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value) => `$${Number(value).toLocaleString()}`}
                  />
                }
              />
            </AreaChart>
          </ChartContainer>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {portfolioAssets.map(asset => (
              <div key={asset.symbol} className="flex items-center p-3 rounded-lg bg-background/50">
                <CryptoIcon name={asset.name} className="h-8 w-8 mr-4" />
                <div className="flex-1">
                  <p className="font-semibold text-base">{asset.symbol}</p>
                  <p className="text-sm font-mono">${asset.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className={cn(
                    "flex items-center justify-end text-sm font-mono font-semibold",
                    asset.change24h >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {asset.change24h >= 0 ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}
                    {Math.abs(asset.change24h)}%
                  </div>
              </div>
            ))}
          </div>
      </CardContent>
    </Card>
  )
}
