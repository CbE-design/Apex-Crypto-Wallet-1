
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { portfolioAssets, marketCoins } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, Repeat, Loader2, Wallet, CheckCircle, XCircle } from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { getExchangeRate } from '@/ai/flows/get-exchange-rate-flow';
import { cn } from '@/lib/utils';

const allAssets = [...portfolioAssets, ...marketCoins].reduce((acc, current) => {
    if (!acc.find(item => item.symbol === current.symbol)) {
        acc.push(current);
    }
    return acc;
}, [] as { symbol: string; name: string }[]);


type TransactionStep = 'connect' | 'approve' | 'swap' | 'processing' | 'success' | 'failed';

export default function SwapPage() {
  const { toast } = useToast();
  const [fromAsset, setFromAsset] = useState(portfolioAssets[0].symbol);
  const [toAsset, setToAsset] = useState(marketCoins[1].symbol);
  const [fromAmount, setFromAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [step, setStep] = useState<TransactionStep>('connect');
  const [isDialogOpen, setIsDialogOpen] = useState(false);


  const fromAssetData = useMemo(() => portfolioAssets.find(a => a.symbol === fromAsset), [fromAsset]);

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
  
  const handleStep = () => {
    if (step === 'connect') {
      setStep('approve');
      toast({ title: "Wallet Connected", description: "You can now proceed with the swap." });
    } else if (step === 'approve') {
       setStep('swap');
       toast({ title: "Approval Successful", description: `You have approved spending ${fromAsset}.` });
    } else if (step === 'swap') {
        if (!fromAmount || parseFloat(fromAmount) <= 0 || !fromAsset || !toAsset) {
            toast({
              title: 'Invalid Input',
              description: 'Please fill out all fields correctly.',
              variant: 'destructive',
            });
            return;
        }
        setStep('processing');
        setIsDialogOpen(true);

        // Simulate transaction time
        setTimeout(() => {
            // Simulate random success/failure
            if (Math.random() > 0.1) { // 90% success rate
                setStep('success');
            } else {
                setStep('failed');
            }
        }, 3000);
    }
  };

  const resetFlow = () => {
    setIsDialogOpen(false);
    setFromAmount('');
    setTimeout(() => { // Allow dialog to close before resetting state
      setStep('connect');
    }, 300);
  }

  const getButton = () => {
    const isDisabled = isLoadingRate || exchangeRate === null || parseFloat(fromAmount) <= 0 || isNaN(parseFloat(fromAmount));
    switch (step) {
        case 'connect':
            return <Button className="w-full" onClick={handleStep}><Wallet className="mr-2" /> Connect Wallet</Button>;
        case 'approve':
            return <Button className="w-full" onClick={handleStep} disabled={isDisabled}>Approve {fromAsset}</Button>;
        case 'swap':
            return <Button className="w-full" onClick={handleStep} disabled={isDisabled}><Repeat className="mr-2" /> Swap</Button>;
        default:
             return <Button className="w-full" disabled><Loader2 className="mr-2 animate-spin" /> Waiting...</Button>;
    }
  }

  const isInputDisabled = step === 'connect';

  return (
    <>
      <div className="flex justify-center items-start pt-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Swap Crypto</CardTitle>
            <CardDescription>Exchange one cryptocurrency for another instantly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className={cn("space-y-2", isInputDisabled && "opacity-50")}>
              <Label htmlFor="from-asset">From</Label>
              <div className="flex gap-2">
                  <Select value={fromAsset} onValueChange={setFromAsset} disabled={isInputDisabled}>
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
                      disabled={isInputDisabled}
                  />
              </div>
              <p className="text-xs text-muted-foreground mt-1 h-4">
                  {!isInputDisabled && `Balance: ${fromAssetData?.amount.toFixed(4) ?? '0.00'}`}
              </p>
            </div>
            
            <div className={cn("flex justify-center items-center", isInputDisabled && "opacity-50")}>
               <div className="w-full h-px bg-border"></div>
               <Button variant="ghost" size="icon" onClick={handleFlipAssets} className="mx-2 flex-shrink-0" disabled={isInputDisabled}>
                  <ArrowLeftRight className="h-4 w-4" />
               </Button>
               <div className="w-full h-px bg-border"></div>
            </div>

            <div className={cn("space-y-2", isInputDisabled && "opacity-50")}>
              <Label htmlFor="to-asset">To</Label>
               <div className="flex gap-2">
                  <Select value={toAsset} onValueChange={setToAsset} disabled={isInputDisabled}>
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
                      disabled={isInputDisabled}
                  />
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground text-center h-5 flex items-center justify-center">
              {!isInputDisabled && isLoadingRate && <Loader2 className="h-4 w-4 animate-spin" />}
              {!isInputDisabled && !isLoadingRate && exchangeRate !== null && exchangeRate > 0 && `1 ${fromAsset} ≈ ${exchangeRate.toFixed(5)} ${toAsset}`}
              {!isInputDisabled && !isLoadingRate && exchangeRate === 0 && <span className="text-destructive">Could not fetch rate</span>}
            </div>

            {getButton()}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center justify-center text-center">
                {step === 'processing' && <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Submitting Transaction</>}
                {step === 'success' && <><CheckCircle className="mr-2 h-6 w-6 text-green-500" /> Swap Successful!</>}
                {step === 'failed' && <><XCircle className="mr-2 h-6 w-6 text-destructive" /> Transaction Failed</>}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center min-h-[60px] flex items-center justify-center">
                {step === 'processing' && 'Your transaction is being broadcast to the network. Please wait for confirmation.'}
                {step === 'success' && `You have successfully swapped ${fromAmount} ${fromAsset} for ~${toAmount} ${toAsset}.`}
                {step === 'failed' && 'There was an error processing your transaction. Please try again.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {step !== 'processing' && (
                <AlertDialogAction onClick={resetFlow}>Close</AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
