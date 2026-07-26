
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { RiskDisclaimer } from '@/components/risk-disclaimer';
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
  const searchParams = useSearchParams();

  const paramFrom = searchParams.get('from');
  const initialFrom = paramFrom && allAssets.some(a => a.symbol === paramFrom) ? paramFrom : staticAssets[0].symbol;

  const [fromAsset, setFromAsset] = useState(initialFrom);
  const [toAsset, setToAsset] = useState(initialFrom === marketCoins[1].symbol ? marketCoins[0].symbol : marketCoins[1].symbol);
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
                currency: fromAsset,
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
                currency: toAsset,
                amount: toAmountNum,
                price: toAssetPrice,
                timestamp: serverTimestamp(),
                status: 'Completed',
                notes: `Swap from ${fromAsset}`
            });

            // Mirror both legs to the top-level transactions subcollection so the
            // dashboard TransactionHistory query (users/{uid}/transactions) can read them.
            const dashSellRef = doc(collection(firestore, 'users', user.uid, 'transactions'));
            transaction.set(dashSellRef, {
                userId: user.uid,
                type: 'Sell',
                currency: fromAsset,
                amount: amountNum,
                price: fromAssetPrice,
                timestamp: serverTimestamp(),
                status: 'Completed',
                notes: `Swap to ${toAsset}`
            });

            const dashBuyRef = doc(collection(firestore, 'users', user.uid, 'transactions'));
            transaction.set(dashBuyRef, {
                userId: user.uid,
                type: 'Buy',
                currency: toAsset,
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
                      You swapped <span className="font-semibold text-white">{fromAmount} {fromAsset}</span> for <span className="font-semibold text-white">{toAmount} {toAsset}</span>.
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
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="from-asset" className="text-[10px] font-semibold uppercase tracking-widest text-white/30">From</Label>
            <div className="flex gap-2">
                <Select value={fromAsset} onValueChange={setFromAsset}>
                    <SelectTrigger id="from-asset" className="w-2/3 h-12 rounded-xl bg-white/[0.04] border-white/[0.08]">
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
                    className="w-1/3 text-right h-12 rounded-xl bg-white/[0.04] border-white/[0.08] font-semibold"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                />
            </div>
            <p className="text-[10px] text-white/30">
                Balance: <span className="font-semibold text-white/60">{(fromAssetBalance ?? 0).toFixed(4)}</span>
            </p>
        </div>
        
        <div className="flex justify-center items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <button onClick={handleFlipAssets} className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 text-violet-400 flex items-center justify-center transition-all">
                <ArrowLeftRight className="h-4 w-4" />
            </button>
            <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        <div className="space-y-2">
            <Label htmlFor="to-asset" className="text-[10px] font-semibold uppercase tracking-widest text-white/30">To</Label>
            <div className="flex gap-2">
                <Select value={toAsset} onValueChange={setToAsset}>
                    <SelectTrigger id="to-asset" className="w-2/3 h-12 rounded-xl bg-white/[0.04] border-white/[0.08]">
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
                    className="w-1/3 text-right h-12 rounded-xl bg-white/[0.02] border-white/[0.05] font-semibold text-white/40 cursor-not-allowed"
                    value={toAmount}
                    readOnly
                />
            </div>
        </div>
        
        <div className="h-5 flex items-center justify-center">
            {isLoadingRate && <Loader2 className="h-4 w-4 animate-spin text-violet-400" />}
            {!isLoadingRate && exchangeRate !== null && exchangeRate > 0 && fromAsset !== toAsset && (
              <span className="text-[11px] font-semibold text-white/30">1 {fromAsset} ≈ <span className="text-cyan-400">{(exchangeRate ?? 0).toFixed(5)} {toAsset}</span></span>
            )}
            {!isLoadingRate && exchangeRate === 0 && <span className="text-red-400 text-[11px] font-semibold">Could not fetch rate</span>}
        </div>

        <AlertDialog>
            <AlertDialogTrigger asChild>
                <button className="w-full h-12 rounded-xl btn-premium font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40" disabled={isButtonDisabled}>
                    <Repeat className="h-4 w-4" /> Swap
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/60">
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px] bg-gradient-to-r from-violet-500 to-cyan-500" />
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-white font-bold">Confirm Swap</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/30">
                        Review the details below. This action cannot be reversed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="space-y-2 py-2">
                    <div className="flex justify-between items-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                        <span className="text-[10px] font-semibold text-white/30 uppercase">From</span>
                        <span className="font-semibold flex items-center gap-2 text-sm text-white/80">
                            <CryptoIcon name={allAssets.find(a => a.symbol === fromAsset)?.name || ''} className="h-4 w-4" />
                            {fromAmount} {fromAsset}
                        </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                        <span className="text-[10px] font-semibold text-white/30 uppercase">To</span>
                        <span className="font-semibold flex items-center gap-2 text-sm text-cyan-400">
                            <CryptoIcon name={allAssets.find(a => a.symbol === toAsset)?.name || ''} className="h-4 w-4" />
                            {toAmount} {toAsset}
                        </span>
                    </div>
                 </div>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl border-white/10 bg-white/[0.04] text-white/40" disabled={isSwapping}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSwap} className="rounded-xl btn-premium" disabled={isSwapping}>
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
        <div className="w-full max-w-md space-y-4">
          <RiskDisclaimer variant="trading" collapsible />
          <div className="rounded-[28px] border border-white/[0.08] bg-[#0A0C12]/90 backdrop-blur-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-500" />
            <div className="px-6 pt-7 pb-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/20">
                  <ArrowLeftRight className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Swap</h2>
                  <p className="text-xs text-white/30">Exchange one cryptocurrency for another</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-6">
              {status === 'idle' ? renderSwapForm() : getStatusContent()}
            </div>
          </div>
          <p className="text-[10px] text-center text-white/20 px-2">
            By confirming a swap you acknowledge our{' '}
            <a href="/legal/risk-disclosure" className="underline hover:text-white/40 transition-colors">Risk Disclosure</a> and{' '}
            <a href="/legal/terms" className="underline hover:text-white/40 transition-colors">Terms of Service</a>.
            Swaps are final and irreversible.
          </p>
        </div>
      </div>
    </PrivateRoute>
  );
}
