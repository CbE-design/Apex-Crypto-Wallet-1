
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { portfolioAssets, marketCoins } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, Repeat, Loader2 } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { getExchangeRate } from '@/ai/flows/get-exchange-rate-flow';

const allAssets = [...portfolioAssets, ...marketCoins].reduce((acc, current) => {
    if (!acc.find(item => item.symbol === current.symbol)) {
        acc.push(current);
    }
    return acc;
}, [] as { symbol: string; name: string }[]);


export default function SwapPage() {
  const { toast } = useToast();
  const [fromAsset, setFromAsset] = useState(portfolioAssets[0].symbol);
  const [toAsset, setToAsset] = useState(marketCoins[1].symbol);
  const [fromAmount, setFromAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  const fromAssetData = useMemo(() => portfolioAssets.find(a => a.symbol === fromAsset), [fromAsset]);
  const toAssetData = useMemo(() => marketCoins.find(a => a.symbol === toAsset), [toAsset]);

  useEffect(() => {
    async function fetchRate() {
      if (!fromAsset || !toAsset) return;

      setIsLoadingRate(true);
      setExchangeRate(null);
      try {
        const result = await getExchangeRate({ fromAsset, toAsset });
        setExchangeRate(result.rate);
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
        toast({
          title: 'Error Fetching Rate',
          description: 'Could not retrieve live exchange rate. Please try again.',
          variant: 'destructive',
        });
        setExchangeRate(0); // Set to 0 to indicate failure
      } finally {
        setIsLoadingRate(false);
      }
    }

    fetchRate();
  }, [fromAsset, toAsset, toast]);


  const toAmount = useMemo(() => {
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0 || exchangeRate === null || exchangeRate === 0) return '0.00';
    return (amount * exchangeRate).toFixed(5);
  }, [fromAmount, exchangeRate]);
  
  const handleSwap = () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !fromAsset || !toAsset) {
      toast({
        title: 'Invalid Input',
        description: 'Please fill out all fields correctly.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Swap Submitted',
      description: `Your order to swap ${fromAmount} ${fromAsset} for ~${toAmount} ${toAsset} has been submitted.`,
    });
    setFromAmount('');
  };

  const handleFlipAssets = () => {
    const tempFrom = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tempFrom);
  };

  return (
    <div className="flex justify-center items-start pt-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Swap Crypto</CardTitle>
          <CardDescription>Exchange one cryptocurrency for another instantly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="from-asset">From</Label>
            <div className="flex gap-2">
                <Select value={fromAsset} onValueChange={setFromAsset}>
                    <SelectTrigger id="from-asset" className="w-2/3">
                        <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                        {allAssets.map(asset => (
                        <SelectItem key={asset.symbol} value={asset.symbol}>
                            <div className="flex items-center gap-2">
                                <CryptoIcon name={asset.name} className="h-5 w-5" />
                                {asset.symbol}
                            </div>
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input 
                    id="from-amount" 
                    type="number" 
                    placeholder="0.00" 
                    className="w-1/3 text-right"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
                Balance: {fromAssetData?.amount.toFixed(4) ?? '0.00'}
            </p>
          </div>
          
          <div className="flex justify-center items-center">
             <div className="w-full h-px bg-border"></div>
             <Button variant="ghost" size="icon" onClick={handleFlipAssets} className="mx-2 flex-shrink-0">
                <ArrowLeftRight className="h-4 w-4" />
             </Button>
             <div className="w-full h-px bg-border"></div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-asset">To</Label>
             <div className="flex gap-2">
                <Select value={toAsset} onValueChange={setToAsset}>
                    <SelectTrigger id="to-asset" className="w-2/3">
                        <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                        {allAssets.map(asset => (
                        <SelectItem key={asset.symbol} value={asset.symbol}>
                             <div className="flex items-center gap-2">
                                <CryptoIcon name={asset.name} className="h-5 w-5" />
                                {asset.symbol}
                            </div>
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input 
                    id="to-amount" 
                    type="text" 
                    placeholder="0.00"
                    className="w-1/3 text-right bg-muted/50"
                    value={toAmount}
                    readOnly
                />
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground text-center h-5 flex items-center justify-center">
            {isLoadingRate && <Loader2 className="h-4 w-4 animate-spin" />}
            {!isLoadingRate && exchangeRate !== null && exchangeRate > 0 && `1 ${fromAsset} ≈ ${exchangeRate.toFixed(5)} ${toAsset}`}
             {!isLoadingRate && exchangeRate === 0 && <span className="text-destructive">Could not fetch rate</span>}
          </div>

          <Button className="w-full" onClick={handleSwap} disabled={isLoadingRate || exchangeRate === null}>
            {isLoadingRate ? 'Getting live rate...' : <>Swap <Repeat className="ml-2" /></>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
