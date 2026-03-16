
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import { Copy, RefreshCw, Loader2, QrCode, Wallet, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PrivateRoute } from '@/components/private-route';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { getLivePrices, getLive24hChanges } from '@/services/crypto-service';
import { useCurrency } from '@/context/currency-context';
import { cn } from '@/lib/utils';
import { marketCoins } from '@/lib/data';

interface WalletDoc {
  id: string;
  currency: string;
  balance: number;
  address: string;
  lastSynced?: any;
}

export default function MyWalletsPage() {
  const { user, syncWalletBalance } = useWallet();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { currency: fiat, formatCurrency } = useCurrency();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<string>('');
  const [selectedQrAddress, setSelectedQrAddress] = useState<{ address: string; currency: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [liveChanges, setLiveChanges] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [initialPricesFetched, setInitialPricesFetched] = useState(false);

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'), orderBy('currency', 'asc'));
  }, [user, firestore]);

  const { data: wallets, isLoading } = useCollection<WalletDoc>(walletsQuery);

  useEffect(() => {
    if (!wallets || wallets.length === 0) return;
    const symbols = wallets.map(w => w.currency);
    if (!initialPricesFetched) {
      setPricesLoading(true);
    }
    Promise.all([
      getLivePrices(symbols, 'USD'),
      getLive24hChanges(symbols),
    ]).then(([prices, changes]) => {
      setLivePrices(prices);
      setLiveChanges(changes);
      setInitialPricesFetched(true);
    }).catch(() => {}).finally(() => setPricesLoading(false));
  }, [wallets, initialPricesFetched]);

  useEffect(() => {
    if (selectedQrAddress?.address) {
      QRCode.toDataURL(selectedQrAddress.address, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
  }, [selectedQrAddress]);

  const handleCopy = (address: string) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast({ title: "Address Copied", description: "Wallet address copied to clipboard." });
  };

  const SYNC_STEPS: Record<string, string[]> = {
    ETH: ['Connecting...', 'Checking for updates...', 'Verifying balance...', 'Almost done...'],
    BTC: ['Connecting...', 'Checking for updates...', 'Verifying balance...', 'Almost done...'],
    SOL: ['Connecting...', 'Checking for updates...', 'Verifying balance...', 'Almost done...'],
    ADA: ['Connecting...', 'Checking for updates...', 'Verifying balance...', 'Almost done...'],
    DEFAULT: ['Connecting...', 'Verifying balance...', 'Almost done...'],
  };

  const handleSync = async (currency: string) => {
    setSyncingId(currency);
    const steps = SYNC_STEPS[currency] || SYNC_STEPS.DEFAULT;
    try {
      for (const step of steps) {
        setSyncStep(step);
        await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
      }
      await syncWalletBalance(currency);
      toast({ title: "Balance Updated", description: `${currency} balance has been refreshed.` });
    } catch {
      toast({ title: "Refresh Failed", description: "Could not update balance. Please try again.", variant: "destructive" });
    } finally {
      setSyncingId(null);
      setSyncStep('');
    }
  };

  const getChainType = (sym: string) => {
    if (['ETH', 'LINK', 'USDT'].includes(sym)) return 'ERC-20';
    if (sym === 'BNB') return 'BEP-20';
    if (sym === 'BTC') return 'Bitcoin';
    if (sym === 'SOL') return 'Solana';
    if (sym === 'ADA') return 'Cardano';
    return 'Native';
  };

  const getExplorerLink = (address: string, sym: string) => {
    if (sym === 'ADA') return `https://cardanoscan.io/address/${address}`;
    if (sym === 'SOL') return `https://solscan.io/account/${address}`;
    if (sym === 'BTC') return `https://www.blockchain.com/explorer/addresses/btc/${address}`;
    if (['ETH', 'LINK', 'BNB', 'USDT'].includes(sym)) return `https://etherscan.io/address/${address}`;
    return `/explorer/${address}`;
  };

  const totalPortfolioUSD = wallets?.reduce((sum, w) => {
    const priceUSD = livePrices[w.currency] || marketCoins.find(c => c.symbol === w.currency)?.priceUSD || 0;
    return sum + w.balance * priceUSD;
  }, 0) || 0;

  return (
    <PrivateRoute>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Assets</h1>
            <p className="text-sm text-muted-foreground">Manage your cryptocurrency holdings</p>
          </div>
          <div className="flex items-center gap-4">
            {!pricesLoading && totalPortfolioUSD > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium">Total Portfolio</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPortfolioUSD * fiat.rate)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2"><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))
          ) : wallets && wallets.length > 0 ? (
            wallets.map((w) => {
              const priceUSD = livePrices[w.currency] || marketCoins.find(c => c.symbol === w.currency)?.priceUSD || 0;
              const valueUSD = w.balance * priceUSD;
              const change = liveChanges[w.currency];
              const coinName = marketCoins.find(c => c.symbol === w.currency)?.name || w.currency;

              return (
                <Card key={w.id} className="relative overflow-hidden bg-card/50 backdrop-blur-sm border-border/60 group">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2.5">
                      <CryptoIcon name={coinName} className="h-7 w-7" />
                      <div>
                        <CardTitle className="text-base font-semibold leading-none">{coinName}</CardTitle>
                        <span className="text-xs text-muted-foreground font-mono">{w.currency}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-medium">
                      {getChainType(w.currency)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Address</p>
                      <div className="flex items-center gap-2 bg-muted/20 p-2.5 rounded-lg font-mono text-xs break-all relative border border-border/40 group/addr">
                        <span className="truncate pr-8 text-muted-foreground">{w.address || 'Pending...'}</span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 absolute right-1 opacity-0 group-hover/addr:opacity-100 transition-opacity"
                          onClick={() => handleCopy(w.address)} disabled={!w.address}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Balance</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-bold tabular-nums">{w.balance.toFixed(w.currency === 'BTC' ? 6 : 4)}</p>
                          <p className="text-sm font-medium text-muted-foreground">{w.currency}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {pricesLoading ? '—' : formatCurrency(valueUSD * fiat.rate)}
                        </p>
                      </div>
                      {change !== undefined && !pricesLoading && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs font-semibold",
                          change >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {Math.abs(change).toFixed(2)}%
                        </div>
                      )}
                    </div>

                    {w.lastSynced && (
                      <Badge variant="secondary" className="h-5 px-2 text-xs bg-green-500/15 text-green-400 border-none gap-1">
                        Verified
                      </Badge>
                    )}
                  </CardContent>
                  <CardFooter className="flex gap-2 bg-muted/10 border-t border-border/40 py-3">
                    <Button
                      className="flex-1 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-300"
                      variant="ghost" size="sm"
                      onClick={() => handleSync(w.currency)}
                      disabled={syncingId === w.currency}
                    >
                      {syncingId === w.currency ? (
                        <><Loader2 className="mr-2 h-3 w-3 animate-spin" /><span className="truncate">{syncStep}</span></>
                      ) : (
                        <><RefreshCw className="mr-2 h-3 w-3" /> Refresh</>
                      )}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 border border-border/60 hover:border-primary/50"
                      onClick={() => { setSelectedQrAddress({ address: w.address, currency: w.currency }); setIsQrOpen(true); }}
                      disabled={!w.address}
                      title="Show QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Link href={getExplorerLink(w.address, w.currency)} passHref target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 border border-border/60 hover:border-primary/50"
                        disabled={!w.address}
                        title="View on Explorer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="bg-muted/30 p-4 rounded-full w-fit mx-auto">
                <Wallet className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Setting Up Your Wallets</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Your wallet addresses are being prepared. This usually takes a few seconds.
              </p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          )}
        </div>

        <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CryptoIcon name={selectedQrAddress?.currency || ''} className="h-5 w-5" />
                {selectedQrAddress?.currency} Deposit Address
              </DialogTitle>
              <DialogDescription>
                Share this address to receive {selectedQrAddress?.currency} into your wallet.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center p-6 bg-white rounded-xl my-4">
              {qrDataUrl
                ? <Image src={qrDataUrl} alt="Deposit QR" width={220} height={220} className="rounded-lg" />
                : <Loader2 className="animate-spin text-muted-foreground h-10 w-10" />
              }
              <div className="mt-4 p-3 bg-gray-100 rounded-lg w-full font-mono text-xs break-all text-center text-gray-900">
                {selectedQrAddress?.address}
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full" onClick={() => handleCopy(selectedQrAddress?.address || '')}>
                <Copy className="h-4 w-4 mr-2" /> Copy Address
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PrivateRoute>
  );
}
