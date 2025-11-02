"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { portfolioAssets as staticAssets, marketCoins } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Loader2 } from "lucide-react"
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, query, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { useWallet } from "@/context/wallet-context"
import { useCurrency } from "@/context/currency-context"

const allTradableAssets = [...staticAssets, ...marketCoins].reduce((acc, current) => {
    if (!acc.find(item => item.symbol === current.symbol)) {
        acc.push(current);
    }
    return acc;
}, [] as { symbol: string; name: string, priceUSD: number }[]);


export function BuySellCard() {
  const { toast } = useToast();
  const { currency, formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState("buy");
  const [amount, setAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(allTradableAssets[0].symbol);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
      const staticAssetData = allTradableAssets.find(sa => sa.symbol === walletDoc.currency);
      if (!staticAssetData) return null;

      return {
        ...staticAssetData,
        id: walletDoc.id,
        amount: walletDoc.balance,
        valueUSD: walletDoc.balance * staticAssetData.priceUSD,
      };
    }).filter(asset => asset !== null && asset.amount > 0) as (typeof allTradableAssets[0] & {id: string; amount: number; valueUSD: number})[];

  }, [walletData]);

  const ownedAssetSymbols = useMemo(() => portfolioAssets.map(a => a.symbol), [portfolioAssets]);

  useEffect(() => {
    setAmount("");
    if (activeTab === 'buy' && !allTradableAssets.some(a => a.symbol === selectedAsset)) {
        setSelectedAsset(allTradableAssets[0].symbol);
    } else if (activeTab === 'sell' && !ownedAssetSymbols.includes(selectedAsset)) {
        setSelectedAsset(ownedAssetSymbols[0] || '');
    }
  }, [activeTab, selectedAsset, ownedAssetSymbols]);

  const currentAssetDetails = allTradableAssets.find(a => a.symbol === selectedAsset);
  const assetPriceInSelectedCurrency = currentAssetDetails ? currentAssetDetails.priceUSD * currency.rate : 0;
  
  const estimatedValue = amount ? (parseFloat(amount) * assetPriceInSelectedCurrency) : 0;
  const currentBalance = portfolioAssets.find(a => a.symbol === selectedAsset)?.amount ?? 0;

  const handleTransaction = async () => {
    const isBuying = activeTab === "buy";
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    
    if (!user || !firestore || !currentAssetDetails) {
        toast({ title: "Error", description: "Cannot process transaction.", variant: "destructive" });
        return;
    }

    if (!isBuying && numericAmount > currentBalance) {
        toast({ title: "Insufficient Funds", description: `You cannot sell more ${selectedAsset} than you own.`, variant: "destructive"});
        return;
    }

    setIsProcessing(true);

    try {
        await runTransaction(firestore, async (transaction) => {
            const walletRef = doc(firestore, 'users', user.uid, 'wallets', selectedAsset);
            const txLogRef = doc(collection(walletRef, 'transactions'));
            
            const currentWalletDoc = await transaction.get(walletRef);
            const currentBalance = currentWalletDoc.exists() ? currentWalletDoc.data().balance : 0;

            const newBalance = isBuying ? currentBalance + numericAmount : currentBalance - numericAmount;
            
            transaction.set(walletRef, { 
                balance: newBalance,
                currency: selectedAsset,
                id: selectedAsset,
                userId: user.uid,
            }, { merge: true });

            transaction.set(txLogRef, {
              type: isBuying ? 'Buy' : 'Sell',
              amount: numericAmount,
              price: currentAssetDetails.priceUSD,
              timestamp: serverTimestamp(),
              valueUSD: numericAmount * currentAssetDetails.priceUSD,
              status: 'Completed'
            });
        });

        toast({
          title: "Transaction Successful",
          description: `Your ${isBuying ? 'buy' : 'sell'} order for ${numericAmount} ${selectedAsset} was successful.`,
        });
        setAmount("");

    } catch (error: any) {
        console.error("Transaction failed:", error);
        toast({
            title: "Transaction Failed",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const numericAmount = parseFloat(amount);
  const isButtonDisabled = isProcessing || isLoading || !amount || numericAmount <= 0 || (activeTab === 'sell' && (!selectedAsset || numericAmount > currentBalance));
  
  const renderForm = (isBuy: boolean) => {
    const assetList = isBuy ? allTradableAssets : portfolioAssets;
    
    return (
        <div className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor={`${activeTab}-asset`}>Asset</Label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset} disabled={isProcessing}>
                    <SelectTrigger id={`${activeTab}-asset`}>
                        <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                        {assetList.length > 0 ? assetList.map(asset => (
                            <SelectItem key={asset.symbol} value={asset.symbol}>
                                {asset.name} ({asset.symbol})
                            </SelectItem>
                        )) : (
                           <SelectItem value="none" disabled>No assets to sell</SelectItem>
                        )}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${activeTab}-amount`}>{`Amount ${!isBuy ? `(Balance: ${currentBalance.toFixed(6)})` : ''}`}</Label>
                <Input 
                    id={`${activeTab}-amount`} 
                    type="number" 
                    placeholder="0.00" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    disabled={isProcessing}
                />
            </div>
            <div className="text-sm text-muted-foreground h-5">
                {amount && `Estimated value: ${formatCurrency(estimatedValue)}`}
            </div>
            <Button className="w-full" onClick={handleTransaction} disabled={isButtonDisabled}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isBuy ? `Buy ${selectedAsset}` : `Sell ${selectedAsset || 'Asset'}`}
                {!isProcessing && <ArrowRight className="ml-2" />}
            </Button>
        </div>
    );
  }

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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy">Buy</TabsTrigger>
                    <TabsTrigger value="sell">Sell</TabsTrigger>
                </TabsList>
                <TabsContent value="buy">
                    {renderForm(true)}
                </TabsContent>
                <TabsContent value="sell">
                    {renderForm(false)}
                </TabsContent>
            </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
