"use client"

import * as React from "react"
import { Pie, PieChart, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { portfolioAssets } from "@/lib/data"
import { CryptoIcon } from "../crypto-icon"
import { cn } from "@/lib/utils"

const chartConfig = {
  value: {
    label: "Value",
  },
  ...Object.fromEntries(portfolioAssets.map((asset, index) => [
    asset.symbol.toLowerCase(),
    {
      label: asset.name,
      color: `hsl(var(--chart-${index + 1}))`,
    }
  ]))
} satisfies ChartConfig

export function PortfolioOverview() {
  const totalBalance = portfolioAssets.reduce((acc, asset) => acc + asset.valueUSD, 0);
  const chartData = portfolioAssets.map(asset => ({
    name: asset.symbol,
    value: asset.valueUSD,
    fill: `var(--color-${asset.symbol.toLowerCase()})`,
  }));

  // Determine the number of digits in the integer part of the balance
  const balanceDigits = Math.floor(totalBalance).toString().length;

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Portfolio Overview</CardTitle>
        <CardDescription>Your current crypto holdings and their values.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-full md:w-1/2 h-72">
          <ChartContainer config={chartConfig} className="min-h-[200px] w-full h-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
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
          </ChartContainer>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none space-y-1">
                <p className="text-sm text-muted-foreground">Total Balance</p>
                <p className={cn(
                  "font-bold",
                  balanceDigits > 10 ? "text-xl" : "text-2xl"
                )}>
                    ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>
        </div>
        <div className="w-full md:w-1/2 space-y-4">
            {portfolioAssets.map(asset => (
              <div key={asset.symbol} className="flex items-center">
                <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: `hsl(var(--chart-${Object.keys(chartConfig).indexOf(asset.symbol.toLowerCase())}))`}} />
                    <CryptoIcon name={asset.name} className="h-6 w-6" />
                    <span className="font-semibold">{asset.name}</span>
                </div>
                <div className="text-right">
                    <p className="font-mono font-semibold">${asset.valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-sm text-muted-foreground">{((asset.valueUSD / totalBalance) * 100).toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
      </CardContent>
    </Card>
  )
}
