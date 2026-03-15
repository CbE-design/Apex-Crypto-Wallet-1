
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
import { getExchangeRate } from '@/ai/flows/get-exchange-rate-flow';
import { cn } from '@/lib/utils';
import { PrivateRoute } from '@/components/private-route';
import { useWallet } from '@/context/wallet-context';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import { marketCoins, portfolioAssets as staticAssets } from '@/lib/data';

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
    async function fetchRate() {
      if (!fromAsset || !toAsset) return;
      if (fromAsset === toAsset) {
        setExchangeRate(1);
        return;
      }

      setIsLoadingRate(true);
      setExchangeRate(null);
      try {
        const result = await getExchangeRate({ fromAsset, toAsset });
        setExchangeRate(result.rate);
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
        toast({
          title: 'Liquidity Bridge Timeout',
          description: 'Could not retrieve real-time exchange rates. Please refresh.',
          variant: 'destructive',
        });
        setExchangeRate(0);
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

  const handleFlipAssets = () => {
    const temp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(temp);
    setFromAmount(''); 
  };
  
  const handleSwap = async () => {
     if (!user || !firestore || !fromAmount || !exchangeRate) {
      toast({ title: 'Operation Rejected', description: 'Missing required settlement parameters.', variant: 'destructive'});
      return;
    }

    const amountNum = parseFloat(fromAmount);
    if (amountNum <= 0 || amountNum > fromAssetBalance) {
        toast({ title: 'Invalid Liquidity', description: 'Please enter a valid amount within your ledger balance.', variant: 'destructive'});
        return;
    }

    setStatus('processing');

    try {
        await runTransaction(firestore, async (transaction) => {
            const fromWalletRef = doc(firestore, 'users', user.uid, 'wallets', fromAsset);
            const fromWalletDoc = await transaction.get(fromWalletRef);
            
            if (!fromWalletDoc.exists() || fromWalletDoc.data().balance < amountNum) {
                throw new Error(`Insufficient ledger balance for ${fromAsset}.`);
            }
            
            const newFromBalance = fromWalletDoc.data().balance - amountNum;
            transaction.update(fromWalletRef, { balance: newFromBalance });

            const toWalletRef = doc(firestore, 'users', user.uid, 'wallets', toAsset);
            const toWalletDoc = await transaction.get(toWalletRef);

            const toAmountNum = parseFloat(toAmount);
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
                type: 'Swap',
                amount: amountNum,
                price: 0,
                timestamp: serverTimestamp(),
                status: 'Completed',
                notes: `Liquidation to ${toAsset}`
            });
            
            const buyTxLogRef = doc(collection(toWalletRef, 'transactions'));
            transaction.set(buyTxLogRef, {
                userId: user.uid,
                type: 'Swap',
                amount: toAmountNum,
                price: 0,
                timestamp: serverTimestamp(),
                status: 'Completed',
                notes: `Acquisition from ${fromAsset}`
            });
        });

        setStatus('success');
        toast({ title: 'Ledger State Updated', description: `Successfully exchanged ${fromAmount} ${fromAsset} for ${toAmount} ${toAsset}.`});

    } catch (error: any) {
        console.error("Asset exchange failed:", error);
        setStatus('failed');
        setErrorMessage(error.message || 'An internal ledger error occurred.');
        toast({ title: 'Exchange Failed', description: error.message || 'Atomic update failed.', variant: 'destructive'});
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
                <div className="flex flex-col items-center justify-center text-center space-y-4 h-96">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h3 className="text-lg font-semibold capitalize">Reconciling Ledger...</h3>
                    <p className="text-muted-foreground">Updating atomic balances on the private rail.</p>
                </div>
            );
        case 'success':
            return (
                 <div className="flex flex-col items-center justify-center text-center space-y-4 h-96">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                    <h3 className="text-lg font-semibold">Exchange Finalized</h3>
                    <p className="text-muted-foreground">Successfully updated ledger for {fromAmount} {fromAsset} ↔ {toAmount} {toAsset}.</p>
                     <Button onClick={resetFlow} className="w-full">Process New Exchange</Button>
                </div>
            );
        case 'failed':
             return (
                 <div className="flex flex-col items-center justify-center text-center space-y-4 h-96">
                    <XCircle className="h-12 w-12 text-destructive" />
                    <h3 className="text-lg font-semibold">Settlement Failure</h3>
                    <p className="text-muted-foreground text-xs break-all">{errorMessage}</p>
                    <Button onClick={resetFlow} variant="outline" className="w-full">Re-Attempt</Button>
                </div>
            );
        default:
            return null;
    }
  }
  
  const renderSwapForm = () => (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="from-asset">Base Asset</Label>
            <div className="flex gap-2">
                <Select value={fromAsset} onValueChange={setFromAsset}>
                    <SelectTrigger id="from-asset" className="w-2/3">
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
                    className="w-1/3 text-right"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                />
            </div>
            <p className="text-xs text-muted-foreground mt-1 h-4">
                {`Ledger Balance: ${fromAssetBalance.toFixed(4)}`}
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
            <Label htmlFor="to-asset">Target Asset</Label>
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
             <p className="text-xs text-muted-foreground mt-1 h-4">
                 &nbsp;
            </p>
        </div>
        
        <div className="text-sm text-muted-foreground text-center h-5 flex items-center justify-center">
            {isLoadingRate && <Loader2 className="h-4 w-4 animate-spin" />}
            {!isLoadingRate && exchangeRate !== null && exchangeRate > 0 && fromAsset !== toAsset && `1 ${fromAsset} ≈ ${exchangeRate.toFixed(5)} ${toAsset}`}
            {!isLoadingRate && exchangeRate === 0 && <span className="text-destructive">Rate Fetch Error</span>}
        </div>

        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={isButtonDisabled}>
                    <Repeat className="mr-2" /> Authorize Exchange
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Finalize Asset Exchange</AlertDialogTitle>
                    <AlertDialogDescription>
                        Please verify the exchange parameters. This operation will update your private ledger balances and cannot be reversed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="space-y-4 py-4 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Liquidation</span>
                        <span className="font-medium flex items-center gap-2">
                            <CryptoIcon name={allAssets.find(a => a.symbol === fromAsset)?.name || ''} />
                            {fromAmount} {fromAsset}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Acquisition</span>
                        <span className="font-medium flex items-center gap-2">
                            <CryptoIcon name={allAssets.find(a => a.symbol === toAsset)?.name || ''} />
                            {toAmount} {toAsset}
                        </span>
                    </div>
                 </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Abort</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSwap}>Confirm & Finalize</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Asset Exchange</CardTitle>
            <CardDescription>Instant settlement between supported ledger protocols.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'idle' ? renderSwapForm() : getStatusContent()}
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
