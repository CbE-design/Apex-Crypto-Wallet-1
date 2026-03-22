
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import {
  Copy, RefreshCw, Loader2, QrCode, Wallet, ExternalLink,
  TrendingUp, TrendingDown, ChevronDown, ChevronRight, FileText,
  Send, ArrowDownToLine, ArrowLeftRight, Banknote,
  ShieldCheck, AlertTriangle, Globe,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PrivateRoute } from '@/components/private-route';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCurrency } from '@/context/currency-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { marketCoins } from '@/lib/data';
import { currencies } from '@/lib/currencies';

async function fetchPricesFromApi(
  symbols: string[],
  currency: string,
): Promise<{ prices: Record<string, number>; changes: Record<string, number> }> {
  const res = await fetch(
    `/api/prices?symbols=${symbols.join(',')}&currency=${currency}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error('Price fetch failed');
  return res.json() as Promise<{ prices: Record<string, number>; changes: Record<string, number> }>;
}

interface WalletDoc {
  id: string;
  currency: string;
  balance: number;
  address: string;
  lastSynced?: { toDate: () => Date } | null;
}

interface TransactionDoc {
  id: string;
  type: string;
  amount: number;
  amountFiat?: number;
  currency?: string;
  netFiat?: number;
  price?: number;
  timestamp?: { toDate: () => Date } | null;
  status?: string;
  referenceNo?: string;
  carfReference?: string;
  travelRuleTag?: boolean;
  method?: string;
  beneficiaryName?: string;
}

function TransactionHistory({ walletCurrency, userId }: { walletCurrency: string; userId: string }) {
  const firestore = useFirestore();
  const { formatCurrency, currency: fiat } = useCurrency();

  const txQuery = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return query(
      collection(firestore, 'users', userId, 'wallets', walletCurrency, 'transactions'),
      orderBy('timestamp', 'desc'),
      firestoreLimit(10)
    );
  }, [firestore, userId, walletCurrency]);

  const { data: transactions, isLoading } = useCollection<TransactionDoc>(txQuery);

  if (isLoading) {
    return (
      <div className="px-4 py-3 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <FileText className="h-5 w-5 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-[11px] text-muted-foreground/60">No transactions yet</p>
      </div>
    );
  }

  const getTypeBadgeClasses = (type: string) => {
    switch (type) {
      case 'Withdrawal': return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
      case 'Buy': return 'text-green-400 border-green-400/30 bg-green-400/10';
      case 'Sell': return 'text-red-400 border-red-400/30 bg-red-400/10';
      case 'Swap': return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
      default: return 'text-accent border-accent/30 bg-accent/10';
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-green-400 border-green-400/30 bg-green-400/10';
      case 'Failed': return 'text-red-400 border-red-400/30 bg-red-400/10';
      case 'Pending': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
      default: return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
    }
  };

  return (
    <div className="px-3 py-2 space-y-1.5 max-h-[300px] overflow-y-auto scroll-container">
      {transactions.map(tx => {
        const date = tx.timestamp ? tx.timestamp.toDate() : new Date();
        const fiatAmountUSD = tx.amount * (tx.price ?? 0);
        return (
          <div key={tx.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl glass-module border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-md', getTypeBadgeClasses(tx.type))}>
                  {tx.type}
                </Badge>
                {tx.status && (
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-md', getStatusBadgeClasses(tx.status))}>
                    {tx.status}
                  </Badge>
                )}
                {tx.carfReference && (
                  <Badge variant="outline" className="text-[8px] h-4 px-1.5 rounded-md text-purple-400 border-purple-400/30 bg-purple-400/10">
                    CARF
                  </Badge>
                )}
                {tx.travelRuleTag && (
                  <Badge variant="outline" className="text-[8px] h-4 px-1.5 rounded-md text-sky-400 border-sky-400/30 bg-sky-400/10">
                    Travel Rule
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {tx.referenceNo && (
                  <span className="text-[9px] font-mono text-muted-foreground/50 tracking-wide truncate">
                    {tx.referenceNo}
                  </span>
                )}
                {tx.carfReference && (
                  <span className="text-[8px] font-mono text-purple-400/50 truncate">
                    CARF: {tx.carfReference}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/40 ml-auto shrink-0">
                  {date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-[11px] font-bold tabular-nums">
                {tx.type === 'Withdrawal' || tx.type === 'Sell' ? '−' : '+'}{tx.amount.toFixed(walletCurrency === 'BTC' ? 6 : 4)} {walletCurrency}
              </p>
              <p className="text-[10px] text-muted-foreground/60 tabular-nums">
                {formatCurrency(fiatAmountUSD * fiat.rate)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MyWalletsPage() {
  const { user, userProfile, syncWalletBalance } = useWallet();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { currency: fiat, formatCurrency, setCurrency } = useCurrency();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<string>('');
  const [selectedQrAddress, setSelectedQrAddress] = useState<{ address: string; currency: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [liveChanges, setLiveChanges] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialPricesFetched = useRef(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set());
  const [isPricePolling, setIsPricePolling] = useState(true);

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'), orderBy('currency', 'asc'));
  }, [user, firestore]);

  const { data: wallets, isLoading } = useCollection<WalletDoc>(walletsQuery);

  const symbolsKey = useMemo(
    () => (wallets ?? []).map(w => w.currency).sort().join(','),
    [wallets],
  );

  useEffect(() => {
    if (!symbolsKey) {
      setPricesLoading(false);
      return;
    }

    const symbols = symbolsKey.split(',');

    async function loadPrices(showSkeleton: boolean) {
      if (showSkeleton) setPricesLoading(true);
      setIsPricePolling(true);
      try {
        const { prices, changes } = await fetchPricesFromApi(symbols, 'USD');
        setLivePrices(prices);
        setLiveChanges(changes);
        setLastUpdated(new Date());
        initialPricesFetched.current = true;
      } catch {
      } finally {
        setPricesLoading(false);
        setIsPricePolling(false);
      }
    }

    loadPrices(!initialPricesFetched.current);

    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => loadPrices(false), 60_000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [symbolsKey]);

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

  const toggleTx = (currency: string) => {
    setExpandedTx(prev => {
      const next = new Set(prev);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
  };

  const totalPortfolioUSD = wallets?.reduce((sum, w) => {
    const priceUSD = livePrices[w.currency] || marketCoins.find(c => c.symbol === w.currency)?.priceUSD || 0;
    return sum + w.balance * priceUSD;
  }, 0) || 0;

  const USD_TO_ZAR = 18.62;

  const getFiatValueZAR = (valueUSD: number) => valueUSD * USD_TO_ZAR;

  const selectedCoinName = selectedQrAddress?.currency
    ? marketCoins.find(c => c.symbol === selectedQrAddress.currency)?.name || selectedQrAddress.currency
    : '';

  return (
    <PrivateRoute>
      <div className="space-y-6">
        <div className="glass-module rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-accent/[0.05] pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold gradient-text">My Assets</h1>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className={cn(
                    "status-dot",
                    isPricePolling ? "text-amber-400" : "text-green-400"
                  )} />
                  <span className="text-[10px] text-muted-foreground/60">
                    {isPricePolling ? 'Updating' : 'Live'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground/70">Manage your cryptocurrency holdings</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {!pricesLoading && totalPortfolioUSD > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">Total Portfolio Value</p>
                    <Select value={fiat.symbol} onValueChange={setCurrency}>
                      <SelectTrigger className="h-6 w-[72px] text-[10px] bg-white/[0.04] border-white/[0.08] rounded-lg px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(c => (
                          <SelectItem key={c.symbol} value={c.symbol} className="text-xs">
                            {c.flag} {c.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-3xl font-bold gradient-text-primary tabular-nums">
                    {formatCurrency(totalPortfolioUSD * fiat.rate)}
                  </p>
                </>
              )}
              {lastUpdated && (
                <p className="text-[10px] text-muted-foreground/40">
                  Last updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="glass-module rounded-2xl card-elevated animate-pulse p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </div>
            ))
          ) : wallets && wallets.length > 0 ? (
            wallets.map((w) => {
              const priceUSD = livePrices[w.currency] || marketCoins.find(c => c.symbol === w.currency)?.priceUSD || 0;
              const valueUSD = w.balance * priceUSD;
              const valueFiat = valueUSD * fiat.rate;
              const valueZAR = getFiatValueZAR(valueUSD);
              const change = liveChanges[w.currency];
              const coinName = marketCoins.find(c => c.symbol === w.currency)?.name || w.currency;
              const isTxExpanded = expandedTx.has(w.currency);
              const showFicaWarning = valueZAR >= 25000;
              const showTravelRule = valueZAR >= 3000;

              return (
                <Card key={w.id} className="relative overflow-hidden glass-module card-elevated border-white/[0.06] group flex flex-col hover:border-white/[0.12] transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.02] pointer-events-none" />

                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-white/[0.08]">
                          <CryptoIcon name={coinName} className="h-6 w-6" />
                        </div>
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold leading-none">{coinName}</CardTitle>
                        <span className="text-xs text-muted-foreground/60 font-mono">{w.currency}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-medium border-white/[0.1] bg-white/[0.03] text-muted-foreground/70 rounded-lg">
                      {getChainType(w.currency)}
                    </Badge>
                  </CardHeader>

                  <CardContent className="relative space-y-4 pt-0 flex-1">
                    <div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-bold tabular-nums gradient-text">
                              {w.balance.toFixed(w.currency === 'BTC' ? 6 : 4)}
                            </p>
                            <p className="text-sm font-medium text-muted-foreground/50">{w.currency}</p>
                          </div>
                          <p className="text-sm text-muted-foreground/70 mt-0.5 tabular-nums">
                            {pricesLoading ? '—' : formatCurrency(valueFiat)}
                          </p>
                        </div>
                        {change !== undefined && !pricesLoading && (
                          <div className={cn(
                            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg",
                            change >= 0
                              ? "text-green-400 bg-green-400/10"
                              : "text-red-400 bg-red-400/10"
                          )}>
                            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {Math.abs(change).toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className={cn(
                        "h-5 px-2 text-[10px] gap-1 rounded-lg border",
                        userProfile?.walletAddress
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        <ShieldCheck className="h-3 w-3" />
                        {userProfile?.walletAddress ? 'KYC Verified' : 'KYC Pending'}
                      </Badge>
                      {showFicaWarning && (
                        <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 gap-1 rounded-lg">
                          <AlertTriangle className="h-3 w-3" />
                          FICA ≥ R25k
                        </Badge>
                      )}
                      {showTravelRule && (
                        <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 gap-1 rounded-lg">
                          <Globe className="h-3 w-3" />
                          Travel Rule ≥ R3k
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <Link
                        href={`/send-receive?currency=${w.currency}&action=send`}
                        className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 group/btn"
                      >
                        <Send className="h-3.5 w-3.5 text-muted-foreground/60 group-hover/btn:text-primary transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground/60 group-hover/btn:text-primary transition-colors">Send</span>
                      </Link>
                      <Link
                        href={`/send-receive?currency=${w.currency}&action=receive`}
                        className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-accent/10 hover:border-accent/20 transition-all duration-200 group/btn"
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5 text-muted-foreground/60 group-hover/btn:text-accent transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground/60 group-hover/btn:text-accent transition-colors">Receive</span>
                      </Link>
                      <Link
                        href={`/swap?from=${w.currency}`}
                        className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-blue-500/10 hover:border-blue-500/20 transition-all duration-200 group/btn"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover/btn:text-blue-400 transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground/60 group-hover/btn:text-blue-400 transition-colors">Swap</span>
                      </Link>
                      <Link
                        href={`/cash-out?currency=${w.currency}`}
                        className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all duration-200 group/btn"
                      >
                        <Banknote className="h-3.5 w-3.5 text-muted-foreground/60 group-hover/btn:text-emerald-400 transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground/60 group-hover/btn:text-emerald-400 transition-colors">Cash Out</span>
                      </Link>
                    </div>
                  </CardContent>

                  <div className="relative border-t border-white/[0.06]">
                    <button
                      onClick={() => toggleTx(w.currency)}
                      className="w-full flex items-center justify-between px-5 py-2.5 text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.02] transition-all duration-200"
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3" />
                        <span>Transactions</span>
                      </div>
                      {isTxExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    {isTxExpanded && user && (
                      <TransactionHistory walletCurrency={w.currency} userId={user.uid} />
                    )}
                  </div>

                  <CardFooter className="relative flex gap-2 border-t border-white/[0.06] py-3 bg-white/[0.01]">
                    <Button
                      className="flex-1 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-300 rounded-xl text-xs"
                      variant="ghost" size="sm"
                      onClick={() => handleSync(w.currency)}
                      disabled={syncingId === w.currency}
                    >
                      {syncingId === w.currency ? (
                        <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /><span className="truncate">{syncStep}</span></>
                      ) : (
                        <><RefreshCw className="mr-1.5 h-3 w-3" /> Refresh</>
                      )}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 rounded-xl border border-white/[0.08] hover:border-primary/30 hover:bg-primary/10 transition-all duration-200"
                      onClick={() => { setSelectedQrAddress({ address: w.address, currency: w.currency }); setIsQrOpen(true); }}
                      disabled={!w.address}
                      title="Show QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Link href={getExplorerLink(w.address, w.currency)} passHref target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-xl border border-white/[0.08] hover:border-primary/30 hover:bg-primary/10 transition-all duration-200"
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
            <div className="col-span-full">
              <div className="glass-module card-elevated rounded-2xl py-20 text-center space-y-5">
                <div className="relative mx-auto w-fit">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                  <div className="relative bg-primary/10 p-5 rounded-full ring-1 ring-white/[0.08]">
                    <Wallet className="h-10 w-10 text-primary/70" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold gradient-text">Setting Up Your Wallets</h3>
                  <p className="text-sm text-muted-foreground/60 max-w-sm mx-auto leading-relaxed">
                    Your secure wallet addresses are being prepared. This usually takes a few seconds.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-white/[0.1] hover:border-primary/30 hover:bg-primary/10"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
            </div>
          )}
        </div>

        <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
          <DialogContent className="sm:max-w-md glass-module border-white/[0.08] rounded-2xl !bg-card/90 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-white/[0.08]">
                  <CryptoIcon name={selectedCoinName} className="h-4 w-4" />
                </div>
                <span>{selectedQrAddress?.currency} Deposit Address</span>
              </DialogTitle>
              <DialogDescription className="text-muted-foreground/60">
                Share this address to receive {selectedQrAddress?.currency} into your wallet.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center p-6 bg-white rounded-xl my-4 shadow-lg">
              {qrDataUrl
                ? <Image src={qrDataUrl} alt="Deposit QR" width={220} height={220} className="rounded-lg" />
                : <Loader2 className="animate-spin text-muted-foreground h-10 w-10" />
              }
            </div>
            <div className="p-3 glass-module rounded-xl font-mono text-xs break-all text-center text-foreground/80 border border-white/[0.06]">
              {selectedQrAddress?.address}
            </div>
            <DialogFooter className="mt-2">
              <Button
                className="w-full btn-premium text-white rounded-xl h-10"
                onClick={() => handleCopy(selectedQrAddress?.address || '')}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy Address
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PrivateRoute>
  );
}
