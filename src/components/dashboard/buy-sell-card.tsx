
"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { portfolioAssets as staticAssets, marketCoins } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Loader2, Landmark } from "lucide-react"
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase'
import { collection, query, doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useCurrency } from "@/context/currency-context"
import { getLivePrices } from "@/services/crypto-service"
import { useWallet } from "@/context/wallet-context"

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
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  
  const { user } = useWallet();
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
  
  const fetchLivePrice = useCallback(async (assetSymbol: string, targetCurrency: string) => {
    if (!assetSymbol) return;
    setIsFetchingPrice(true);
    setLivePrice(null);
    try {
        const prices = await getLivePrices([assetSymbol], targetCurrency);
        const price = prices[assetSymbol];
        if (price !== undefined) {
            setLivePrice(price);
        } else {
            throw new Error('Price not found');
        }
    } catch (error) {
        console.error("Failed to fetch live price:", error);
        const staticPrice = allTradableAssets.find(a => a.symbol === assetSymbol)?.priceUSD || 0;
        setLivePrice(staticPrice * currency.rate); // Fallback to static price
        toast({
            title: "Could Not Fetch Live Price",
            description: "Using a fallback price. The final transaction value may differ.",
            variant: "destructive"
        });
    } finally {
        setIsFetchingPrice(false);
    }
  }, [currency.rate, toast]);


  useEffect(() => {
    setAmount("");
    let defaultAsset = allTradableAssets[0].symbol; 
    if (activeTab === 'sell' && ownedAssetSymbols.length > 0) {
      defaultAsset = ownedAssetSymbols[0];
    } else if (activeTab === 'sell') {
      defaultAsset = allTradableAssets[0].symbol;
    }
    
    setSelectedAsset(defaultAsset);
    if (defaultAsset) {
        fetchLivePrice(defaultAsset, currency.symbol);
    } else {
        setLivePrice(null);
    }
}, [activeTab, ownedAssetSymbols, fetchLivePrice, currency.symbol]);
  
  useEffect(() => {
      if (selectedAsset) {
          fetchLivePrice(selectedAsset, currency.symbol);
      }
  }, [selectedAsset, currency.symbol, fetchLivePrice]);
  
  
  const estimatedValue = useMemo(() => {
    if (!amount || !livePrice) return 0;
    return parseFloat(amount) * livePrice;
  }, [amount, livePrice]);

  const currentBalance = useMemo(() => portfolioAssets.find(a => a.symbol === selectedAsset)?.amount ?? 0, [portfolioAssets, selectedAsset]);
  

  const handleTransaction = async () => {
    const isBuying = activeTab === "buy";
    if (isBuying) {
        toast({ title: "Feature Not Available", description: "Buying from an external source is not yet implemented.", variant: "destructive" });
        return;
    }

    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    
    if (!user || !firestore || !livePrice) {
        toast({ title: "Error", description: "Cannot process transaction. Live price is unavailable.", variant: "destructive" });
        return;
    }

    if (!isBuying) { // is selling
        if (numericAmount > currentBalance) {
            toast({ title: "Insufficient Asset Balance", description: `You cannot sell more ${selectedAsset} than you own.`, variant: "destructive"});
            return;
        }
    }

    setIsProcessing(true);

    try {
        const priceInUSD = livePrice / currency.rate;

        await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', user.uid);
            const walletRef = doc(firestore, 'users', user.uid, 'wallets', selectedAsset);
            const txLogRef = doc(collection(walletRef, 'transactions'));
            
            const currentWalletDoc = await transaction.get(walletRef);
            
            const currentWalletBalance = currentWalletDoc.exists() ? currentWalletDoc.data().balance : 0;
            
            if (numericAmount > currentWalletBalance) {
                throw new Error(`Insufficient balance of ${selectedAsset}.`);
            }
            // For now, "selling" just removes the asset from the wallet.
            // We can later add logic to credit a USD balance if needed.
            const newWalletBalance = currentWalletBalance - numericAmount;
            transaction.update(walletRef, { balance: newWalletBalance });
            
            transaction.set(txLogRef, {
              type: 'Sell',
              amount: numericAmount,
              price: priceInUSD,
              timestamp: serverTimestamp(),
              valueUSD: numericAmount * priceInUSD,
              status: 'Completed'
            });
        });

        toast({
          title: "Transaction Successful",
          description: `Your sell order for ${numericAmount} ${selectedAsset} was successful.`,
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
  
  const isButtonDisabled = 
    isProcessing || 
    isLoading || 
    isFetchingPrice || 
    !amount || 
    numericAmount <= 0 || 
    !livePrice ||
    (activeTab === 'buy') || // Disable buy button for now
    (activeTab === 'sell' && (!selectedAsset || numericAmount > currentBalance));
  
  const renderForm = (isBuy: boolean) => {
    const assetList = isBuy ? allTradableAssets : portfolioAssets;
    
    return (
        <div className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor={`${activeTab}-asset`}>Asset</Label>
                <Select 
                    value={selectedAsset} 
                    onValueChange={(value) => {
                        setSelectedAsset(value);
                        fetchLivePrice(value, currency.symbol);
                    }} 
                    disabled={isProcessing}
                >
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
                <Label htmlFor={`${activeTab}-amount`}>Amount</Label>
                <Input 
                    id={`${activeTab}-amount`} 
                    type="number" 
                    placeholder="0.00" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    disabled={isProcessing || isBuy}
                />
            </div>
            <div className="text-sm text-muted-foreground h-5 flex items-center justify-between">
                <div>
                  {isFetchingPrice && <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fetching live price...</>}
                  {!isFetchingPrice && livePrice && `Est. value: ${formatCurrency(estimatedValue)}`}
                  {!isFetchingPrice && !livePrice && selectedAsset && <span className="text-destructive">Could not load price</span>}
                </div>
                {!isBuy && (
                    <div className="text-xs">
                        Balance: {currentBalance.toFixed(6)}
                    </div>
                )}
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
                    <div className="pt-4 text-center text-muted-foreground text-sm space-y-4">
                        <p>To acquire assets, another user must send them to your wallet address.</p>
                        <p>The "Buy" feature from an external source is not implemented in this simulation.</p>
                    </div>
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
