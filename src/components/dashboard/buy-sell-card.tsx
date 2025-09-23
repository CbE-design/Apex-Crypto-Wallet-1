"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { portfolioAssets } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight } from "lucide-react"

export function BuySellCard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("buy");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(portfolioAssets[0].symbol);

  const asset = portfolioAssets.find(a => a.symbol === selectedAsset);
  const estimatedBuyValue = buyAmount && asset ? (parseFloat(buyAmount) * asset.priceUSD).toFixed(2) : "0.00";
  const estimatedSellValue = sellAmount && asset ? (parseFloat(sellAmount) * asset.priceUSD).toFixed(2) : "0.00";

  const handleTransaction = () => {
    const isBuying = activeTab === "buy";
    const amount = isBuying ? buyAmount : sellAmount;
    const value = isBuying ? estimatedBuyValue : estimatedSellValue;

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to transact.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Transaction Submitted",
      description: `Your ${activeTab} order for ${amount} ${selectedAsset} (approx. $${value}) has been submitted.`,
    });

    if (isBuying) setBuyAmount("");
    else setSellAmount("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buy / Sell Crypto</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="buy" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>
          <TabsContent value="buy">
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="buy-asset">Asset</Label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                  <SelectTrigger id="buy-asset">
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolioAssets.map(asset => (
                      <SelectItem key={asset.symbol} value={asset.symbol}>
                        {asset.name} ({asset.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-amount">Amount</Label>
                <Input id="buy-amount" type="number" placeholder="0.00" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} />
              </div>
              <div className="text-sm text-muted-foreground">
                Estimated value: ${estimatedBuyValue}
              </div>
              <Button className="w-full" onClick={handleTransaction}>
                Buy {selectedAsset} <ArrowRight className="ml-2" />
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="sell">
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="sell-asset">Asset</Label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                  <SelectTrigger id="sell-asset">
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolioAssets.map(asset => (
                      <SelectItem key={asset.symbol} value={asset.symbol}>
                        {asset.name} ({asset.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sell-amount">Amount</Label>
                <Input id="sell-amount" type="number" placeholder="0.00" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} />
              </div>
               <div className="text-sm text-muted-foreground">
                Estimated value: ${estimatedSellValue}
              </div>
              <Button variant="destructive" className="w-full" onClick={handleTransaction}>
                Sell {selectedAsset} <ArrowRight className="ml-2" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
