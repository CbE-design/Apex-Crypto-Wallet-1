
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, Repeat, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { cn } from '@/lib/utils';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import { marketCoins, portfolioAssets as staticAssets } from '@/lib/data';

async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  try {
    const res = await fetch(`/api/prices?symbols=${symbols.join(',')}&currency=USD`, { cache: 'no-store' });
    if (!res.ok) throw new Error('price fetch failed');
    const { prices } = await res.json() as { prices: Record<string, number>; changes: Record<string, number> };
    return prices;
  } catch {
    return {};
  }
}

const allAssets = [...staticAssets, ...marketCoins].reduce((acc, current) => {
    if (!acc.find(item => item.symbol === current.symbol)) {
        acc.push(current);
    }
    return acc;
}, [] as { symbol: string; name: string }[]);

type SwapStatus = 'idle' | 'processing' | 'success' | 'failed';

export default function SwapPage() {
  const { toast } = useToast();
  const { user } = useWallet();
  const firestore = useFirestore();

  const [fromAsset, setFromAsset] = useState(staticAssets[0].symbol);
  const [toAsset, setToAsset] = useState(marketCoins[1].symbol);
  const [fromAmount, setFromAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);

  const { data: userWallets } = useCollection(walletsQuery);

  const fromAssetBalance = useMemo(() => {
    if (!userWallets) return 0;
    const assetWallet = userWallets.find(w => w.currency === fromAsset);
    return assetWallet ? assetWallet.balance : 0;
  }, [userWallets, fromAsset]);


  useEffect(() => {
    if (!fromAsset || !toAsset) return;
    if (fromAsset === toAsset) { setExchangeRate(1); return; }

    let cancelled = false;
    setIsLoadingRate(true);
    setExchangeRate(null);

    getPrices([fromAsset, toAsset]).then(prices => {
      if (cancelled) return;
      const fromPrice = prices[fromAsset];
      const toPrice   = prices[toAsset];
      if (fromPrice && toPrice && toPrice > 0) {
        setExchangeRate(fromPrice / toPrice);
      } else {
        const fallbackFrom = staticAssets.find(a => a.symbol === fromAsset)?.priceUSD
          || marketCoins.find(c => c.symbol === fromAsset)?.priceUSD || 0;
        const fallbackTo = staticAssets.find(a => a.symbol === toAsset)?.priceUSD
          || marketCoins.find(c => c.symbol === toAsset)?.priceUSD || 1;
        setExchangeRate(fallbackTo > 0 ? fallbackFrom / fallbackTo : 0);
      }
    }).catch(() => {
      if (!cancelled) setExchangeRate(0);
    }).finally(() => {
      if (!cancelled) setIsLoadingRate(false);
    });

    return () => { cancelled = true; };
  }, [fromAsset, toAsset]);


  const toAmount = useMemo(() => {
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0 || exchangeRate === null || exchangeRate === 0) return '0.00';
    return (amount * exchangeRate).toFixed(5);
  }, [fromAmount, exchangeRate]);

  const handleFlipAssets = () => {
    const temp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(temp);
    setFromAmount('');
  };
  
  const handleSwap = async () => {
     if (!user || !firestore || !fromAmount || !exchangeRate || isSwapping) {
      toast({ title: 'Cannot process swap', description: 'Missing required information.', variant: 'destructive'});
      return;
    }
    setIsSwapping(true);

    const amountNum = parseFloat(fromAmount);
    if (amountNum <= 0 || amountNum > fromAssetBalance) {
        toast({ title: 'Invalid Amount', description: 'Please enter a valid amount to swap.', variant: 'destructive'});
        setIsSwapping(false);
        return;
    }

    setStatus('processing');

    try {
        // Fetch prices BEFORE entering the Firestore transaction
        const livePriceMap = await getPrices([fromAsset, toAsset]);
        const fromAssetPrice = livePriceMap[fromAsset] || staticAssets.find(a => a.symbol === fromAsset)?.priceUSD || 0;
        const toAssetPrice   = livePriceMap[toAsset]   || marketCoins.find(m => m.symbol === toAsset)?.priceUSD || 0;

        const toAmountNum = parseFloat(toAmount);

        await runTransaction(firestore, async (transaction) => {
            const fromWalletRef = doc(firestore, 'users', user.uid, 'wallets', fromAsset);
            const fromWalletDoc = await transaction.get(fromWalletRef);
            
            if (!fromWalletDoc.exists() || fromWalletDoc.data().balance < amountNum) {
                throw new Error(`Insufficient balance of ${fromAsset}.`);
            }
            
            const newFromBalance = fromWalletDoc.data().balance - amountNum;
            transaction.update(fromWalletRef, { balance: newFromBalance });

            const toWalletRef = doc(firestore, 'users', user.uid, 'wallets', toAsset);
            const toWalletDoc = await transaction.get(toWalletRef);

            const currentToBalance = toWalletDoc.exists() ? toWalletDoc.data().balance : 0;
            const newToBalance = currentToBalance + toAmountNum;
            
            transaction.set(toWalletRef, {
                balance: newToBalance,
                currency: toAsset,
                id: toAsset,
                userId: user.uid,
            }, { merge: true });

            const sellTxLogRef = doc(collection(fromWalletRef, 'transactions'));
            transaction.set(sellTxLogRef, {
                userId: user.uid,
                type: 'Sell',
                amount: amountNum,
                price: fromAssetPrice,
                timestamp: serverTimestamp(),
                status: 'Completed',
                notes: `Swap to ${toAsset}`
            });
            
            const buyTxLogRef = doc(collection(toWalletRef, 'transactions'));
            transaction.set(buyTxLogRef, {
                userId: user.uid,
                type: 'Buy',
                amount: toAmountNum,
                price: toAssetPrice,
                timestamp: serverTimestamp(),
                status: 'Completed',
                notes: `Swap from ${fromAsset}`
            });
        });

        setStatus('success');
        toast({ title: 'Swap Successful', description: `Swapped ${fromAmount} ${fromAsset} for ${toAmount} ${toAsset}.`});

    } catch (err) {
        console.error("Swap failed:", err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred during the swap.';
        setStatus('failed');
        setErrorMessage(message);
        toast({ title: 'Swap Failed', description: message, variant: 'destructive'});
    } finally {
        setIsSwapping(false);
    }
  }


  const resetFlow = () => {
    setStatus('idle');
    setFromAmount('');
    setErrorMessage('');
  }

  const isButtonDisabled = isLoadingRate || status === 'processing' || !fromAmount || parseFloat(fromAmount) <= 0 || !exchangeRate || fromAsset === toAsset || parseFloat(fromAmount) > fromAssetBalance;
  
  const getStatusContent = () => {
    switch(status) {
        case 'processing':
            return (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
                    <div className="p-4 bg-primary/10 rounded-full">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Processing Swap</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Please wait while your transaction is being processed.</p>
                </div>
            );
        case 'success':
            return (
                 <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
                    <div className="p-4 bg-accent/10 rounded-full">
                      <CheckCircle className="h-10 w-10 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold">Swap Successful</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      You swapped <span className="font-semibold text-foreground">{fromAmount} {fromAsset}</span> for <span className="font-semibold text-foreground">{toAmount} {toAsset}</span>.
                    </p>
                    <Button onClick={resetFlow} className="w-full mt-2 btn-premium">New Swap</Button>
                </div>
            );
        case 'failed':
             return (
                 <div className="flex flex-col items-center justify-center text-center space-y-4 py-16">
                    <div className="p-4 bg-destructive/10 rounded-full">
                      <XCircle className="h-10 w-10 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold">Swap Failed</h3>
                    <p className="text-sm text-muted-foreground max-w-xs break-all">{errorMessage}</p>
                    <Button onClick={resetFlow} variant="outline" className="w-full mt-2">Try Again</Button>
                </div>
            );
        default:
            return null;
    }
  }
  
  const renderSwapForm = () => (
    <div className="space-y-5">
        <div className="space-y-2">
            <Label htmlFor="from-asset" className="text-xs font-medium text-muted-foreground">From</Label>
            <div className="flex gap-2">
                <Select value={fromAsset} onValueChange={setFromAsset}>
                    <SelectTrigger id="from-asset" className="w-2/3 h-12 rounded-xl bg-muted/20 border-border/60">
                        <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                        {allAssets.map(asset => (
                        <SelectItem key={asset.symbol} value={asset.symbol} disabled={!userWallets?.some(w => w.currency === asset.symbol && w.balance > 0)}>
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
                    className="w-1/3 text-right h-12 rounded-xl bg-muted/20 border-border/60 font-semibold"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
                Balance: <span className="font-medium text-foreground">{fromAssetBalance.toFixed(4)}</span>
            </p>
        </div>
        
        <div className="flex justify-center items-center">
            <div className="w-full h-px bg-border/40"></div>
            <Button variant="outline" size="icon" onClick={handleFlipAssets} className="mx-3 flex-shrink-0 h-10 w-10 rounded-xl border-border/60 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all">
                <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <div className="w-full h-px bg-border/40"></div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="to-asset" className="text-xs font-medium text-muted-foreground">To</Label>
            <div className="flex gap-2">
                <Select value={toAsset} onValueChange={setToAsset}>
                    <SelectTrigger id="to-asset" className="w-2/3 h-12 rounded-xl bg-muted/20 border-border/60">
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
                    className="w-1/3 text-right h-12 rounded-xl bg-muted/10 border-border/40 font-semibold text-muted-foreground"
                    value={toAmount}
                    readOnly
                />
            </div>
        </div>
        
        <div className="text-sm text-muted-foreground text-center h-5 flex items-center justify-center">
            {isLoadingRate && <Loader2 className="h-4 w-4 animate-spin" />}
            {!isLoadingRate && exchangeRate !== null && exchangeRate > 0 && fromAsset !== toAsset && (
              <span className="font-medium">1 {fromAsset} ≈ {exchangeRate.toFixed(5)} {toAsset}</span>
            )}
            {!isLoadingRate && exchangeRate === 0 && <span className="text-destructive text-xs">Could not fetch rate</span>}
        </div>

        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button className="w-full h-12 rounded-xl btn-premium font-semibold" disabled={isButtonDisabled}>
                    <Repeat className="mr-2 h-4 w-4" /> Swap
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg font-bold">Confirm Swap</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm">
                        Review the details below. This action cannot be reversed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="space-y-3 py-4">
                    <div className="flex justify-between items-center p-3 bg-muted/20 rounded-xl">
                        <span className="text-sm text-muted-foreground">From</span>
                        <span className="font-semibold flex items-center gap-2">
                            <CryptoIcon name={allAssets.find(a => a.symbol === fromAsset)?.name || ''} className="h-4 w-4" />
                            {fromAmount} {fromAsset}
                        </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/20 rounded-xl">
                        <span className="text-sm text-muted-foreground">To</span>
                        <span className="font-semibold flex items-center gap-2">
                            <CryptoIcon name={allAssets.find(a => a.symbol === toAsset)?.name || ''} className="h-4 w-4" />
                            {toAmount} {toAsset}
                        </span>
                    </div>
                 </div>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl" disabled={isSwapping}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSwap} className="rounded-xl" disabled={isSwapping}>
                        {isSwapping ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Swapping...</> : 'Confirm Swap'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-4">
        <Card className="w-full max-w-md bg-card/60 backdrop-blur-sm border-border/60">
          <CardHeader className="border-b border-border/40 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Swap</CardTitle>
                <CardDescription className="text-sm">Exchange one cryptocurrency for another</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {status === 'idle' ? renderSwapForm() : getStatusContent()}
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
