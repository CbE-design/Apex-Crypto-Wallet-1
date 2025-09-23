"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { portfolioAssets } from "@/lib/data"
import { CryptoIcon } from "../crypto-icon"
import { cn } from "@/lib/utils"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

export function PortfolioOverview() {
  const chartData = portfolioAssets.map(asset => ({
    name: asset.symbol,
    value: asset.valueUSD,
    fill: `hsl(var(--chart-${(portfolioAssets.indexOf(asset) % 5) + 1}))`,
  }));

  const totalBalance = portfolioAssets.reduce((acc, asset) => acc + asset.valueUSD, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Overview</CardTitle>
        <CardDescription>Your current crypto holdings and their values.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col items-center justify-center">
             <div className="text-4xl font-bold tracking-tighter">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-muted-foreground">Total Balance</p>
            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ChartContainer config={{}}>
                  <PieChart>
                    <ChartTooltip 
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5} />
                  </PieChart>
                </ChartContainer>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-4">
            {portfolioAssets.map(asset => (
              <div key={asset.symbol} className="flex items-center">
                <CryptoIcon name={asset.name} className="h-8 w-8 mr-4" />
                <div className="flex-1">
                  <p className="font-semibold">{asset.name}</p>
                  <p className="text-sm text-muted-foreground">{asset.amount} {asset.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${asset.valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <div className={cn(
                    "flex items-center justify-end text-sm",
                    asset.change24h >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {asset.change24h >= 0 ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}
                    {Math.abs(asset.change24h)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
