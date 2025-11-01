
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { portfolioAssets as staticAssets } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Loader2 } from "lucide-react"
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase'
import { collection, query, doc, writeBatch, serverTimestamp } from 'firebase/firestore'

export function BuySellCard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("buy");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(staticAssets[0].symbol);
  
  const { user } = useUser();
  const firestore = useFirestore();

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);
  
  const { data: walletData, isLoading } = useCollection<{balance: number, currency: string, id: string}>(walletsQuery);
  
  const portfolioAssets = useMemo(() => {
    if (!walletData) return [];
    
    return walletData.map(walletDoc => {
      const staticAssetData = staticAssets.find(sa => sa.symbol === walletDoc.currency);
      if (!staticAssetData) return null;

      return {
        ...staticAssetData,
        id: walletDoc.id, // Keep the document ID
        amount: walletDoc.balance,
        valueUSD: walletDoc.balance * staticAssetData.priceUSD,
      };
    }).filter(Boolean) as (typeof staticAssets & {id: string})[];

  }, [walletData]);


  const assetForDisplay = portfolioAssets.find(a => a.symbol === selectedAsset) || staticAssets.find(a => a.symbol === selectedAsset);
  const estimatedBuyValue = buyAmount && assetForDisplay ? (parseFloat(buyAmount) * assetForDisplay.priceUSD).toFixed(2) : "0.00";
  const estimatedSellValue = sellAmount && assetForDisplay ? (parseFloat(sellAmount) * assetForDisplay.priceUSD).toFixed(2) : "0.00";

  const handleTransaction = async () => {
    const isBuying = activeTab === "buy";
    const amountStr = isBuying ? buyAmount : sellAmount;
    const amount = parseFloat(amountStr);
    const value = parseFloat(isBuying ? estimatedBuyValue : estimatedSellValue);

    if (!amountStr || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to transact.",
        variant: "destructive",
      });
      return;
    }
    
    if (!user || !firestore) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        return;
    }

    const assetToTransact = portfolioAssets.find(a => a.symbol === selectedAsset);

    if (isBuying) {
        const walletRef = doc(firestore, 'users', user.uid, 'wallets', selectedAsset);
        const newBalance = (assetToTransact?.amount || 0) + amount;

        const batch = writeBatch(firestore);
        batch.set(walletRef, { balance: newBalance }, { merge: true });

        const txLogRef = doc(collection(firestore, 'users', user.uid, 'wallets', selectedAsset, 'transactions'));
        batch.set(txLogRef, {
          type: 'Buy',
          amount: amount,
          price: assetForDisplay?.priceUSD,
          timestamp: serverTimestamp(),
          valueUSD: value,
          status: 'Completed'
        });
        
        await batch.commit();

        toast({
          title: "Transaction Submitted",
          description: `Your buy order for ${amount} ${selectedAsset} (approx. $${value}) has been submitted.`,
        });
        setBuyAmount("");

    } else { // Selling logic
        if (!assetToTransact) {
             toast({
                title: "Asset Not Found",
                description: `You do not have any ${selectedAsset} in your portfolio.`,
                variant: "destructive",
            });
            return;
        }

        if (amount > assetToTransact.amount) {
            toast({
                title: "Insufficient Funds",
                description: `Your balance of ${assetToTransact.amount.toFixed(4)} ${assetToTransact.name} is not enough to sell ${amount}.`,
                variant: "destructive",
            });
            return;
        }
        
        const walletRef = doc(firestore, 'users', user.uid, 'wallets', assetToTransact.id);
        const newBalance = assetToTransact.amount - amount;

        const batch = writeBatch(firestore);
        batch.update(walletRef, { balance: newBalance });

        const txLogRef = doc(collection(firestore, 'users', user.uid, 'wallets', selectedAsset, 'transactions'));
        batch.set(txLogRef, {
            type: 'Sell',
            amount: amount,
            price: assetForDisplay?.priceUSD,
            timestamp: serverTimestamp(),
            valueUSD: value,
            status: 'Completed'
        });

        await batch.commit();

        toast({
          title: "Transaction Submitted",
          description: `Your sell order for ${amount} ${selectedAsset} (approx. $${value}) has been submitted.`,
        });
        setSellAmount("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buy / Sell Crypto</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : (
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
                        {staticAssets.map(asset => ( // Allow buying any asset
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
                    <Label htmlFor="sell-amount">Amount ({`Balance: ${assetForDisplay?.amount?.toFixed(4) ?? '0.00'}`})</Label>
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
        )}
      </CardContent>
    </Card>
  )
}
