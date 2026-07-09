'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/wallet-context';
import { useFirestore } from '@/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { CryptoIcon } from '@/components/crypto-icon';
import KYCVerificationModal from '@/components/kyc-verification-modal';
import type { KYCStatus } from '@/lib/types';
import {
  Copy, RefreshCw, Loader2, QrCode, Wallet, ExternalLink,
  TrendingUp, TrendingDown, ChevronDown, ChevronRight, FileText,
  Send, ArrowDownToLine, ArrowLeftRight, Banknote,
  ShieldCheck, AlertTriangle, Globe, ShieldAlert, Clock, ArrowRight, CheckCircle2, XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PrivateRoute } from '@/components/private-route';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCurrency } from '@/context/currency-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatAppTimeShort, formatAppDate } from '@/lib/utils';
import { marketCoins } from '@/lib/data';
import { currencies } from '@/lib/currencies';
import { useLivePrices } from '@/hooks/use-live-prices';

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
  price?: number;
  currency?: string;
  timestamp?: any;
  status?: string;
  referenceNo?: string;
  carfReference?: string;
  method?: string;
}

const deriveAddress = (symbol: string, ethAddress: string) => {
  if (!ethAddress) return '';
  if (['ETH', 'LINK', 'BNB', 'USDT', 'USDC', 'UNI'].includes(symbol)) return ethAddress;
  if (symbol === 'SOL') return ethAddress.replace('0x', 'Sol') + 'Identity';
  if (symbol === 'ADA') return 'addr1' + ethAddress.substring(2, 42);
  if (symbol === 'BTC') return '1' + ethAddress.substring(2, 35);
  return 'Identity_' + symbol + '_' + ethAddress.substring(2, 12);
};

function TransactionHistory({ walletCurrency, userId }: { walletCurrency: string; userId: string }) {
  const firestore = useFirestore();
  const { formatCurrency, currency: fiat } = useCurrency();
  const [transactions, setTransactions] = useState<TransactionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTx = useCallback(async () => {
    if (!firestore || !userId) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(firestore, 'users', userId, 'wallets', walletCurrency, 'transactions'));
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as TransactionDoc));
      const sorted = data.sort((a, b) => {
        const t1 = a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ?? 0) * 1000 ?? 0;
        const t2 = b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ?? 0) * 1000 ?? 0;
        return t2 - t1;
      }).slice(0, 10);
      
      setTransactions(sorted);
    } catch (err) {
      console.error('Error fetching wallet transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [firestore, userId, walletCurrency]);

  useEffect(() => {
    fetchTx();
  }, [fetchTx]);

  if (loading) {
    return (
      <div className="px-4 py-3 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded-md bg-white/5" />
            <Skeleton className="h-4 w-16 rounded-md bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="px-4 py-8 text-center bg-white/[0.01]">
        <FileText className="h-4 w-4 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-[11px] text-muted-foreground/60 font-bold uppercase tracking-widest">No Recent Activity</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2 max-h-[350px] overflow-y-auto scroll-container bg-black/10">
      {transactions.map(tx => {
        const fiatAmountUSD = tx.amount * (tx.price ?? 0);
        const isOut = tx.type === 'Withdrawal' || tx.type === 'Sell' || tx.type === 'Send';
        return (
          <div key={tx.id} className="flex items-center justify-between px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={cn('text-[9px] font-black uppercase', isOut ? 'text-red-400 border-red-400/20' : 'text-green-400 border-green-400/20')}>
                  {tx.type}
                </Badge>
                <span className="text-[10px] text-muted-foreground/40 font-medium">
                   {formatAppDate(tx.timestamp)}
                </span>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground/30 mt-1 truncate max-w-[120px]">
                {tx.referenceNo || 'Internal Transaction'}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className={cn("text-[11px] font-black tabular-nums", isOut ? 'text-red-400' : 'text-green-400')}>
                {isOut ? '−' : '+'}{(tx.amount ?? 0).toFixed(walletCurrency === 'BTC' ? 6 : 4)}
              </p>
              <p className="text-[9px] text-muted-foreground/60 font-bold">
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
  
  const [wallets, setWallets] = useState<WalletDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<string>('');
  const [selectedQrAddress, setSelectedQrAddress] = useState<{ address: string; currency: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set<string>());
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerAddress, setExplorerAddress] = useState<string | null>(null);
  const [explorerCurrency, setExplorerCurrency] = useState<string | null>(null);

  const fetchWallets = useCallback(async () => {
    if (!user || !firestore) return;
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(firestore, 'users', user.uid, 'wallets'));
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as WalletDoc));
      setWallets(data.sort((a, b) => a.currency.localeCompare(b.currency)));
    } catch (err) {
      console.error('Wallet fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, firestore]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const symbols = useMemo(() => wallets.map(w => w.currency), [wallets]);
  const { prices: livePrices, changes: liveChanges, isRefreshing: isPricePolling, lastUpdated, refresh: refreshPrices } = useLivePrices(symbols, 'USD');

  useEffect(() => {
    if (!isLoading && user && wallets.length === 0 && !isProvisioning && firestore) {
      const provision = async () => {
        setIsProvisioning(true);
        try {
          const batch = writeBatch(firestore);
          const ethAddress = userProfile?.walletAddress || '0x' + Math.random().toString(16).slice(2, 42);
          marketCoins.forEach(coin => {
            const walletRef = doc(firestore, 'users', user.uid, 'wallets', coin.symbol);
            batch.set(walletRef, {
              id: coin.symbol, userId: user.uid, currency: coin.symbol, balance: 0,
              address: deriveAddress(coin.symbol, ethAddress), lastSynced: serverTimestamp()
            }, { merge: true });
          });
          await batch.commit();
          fetchWallets();
        } catch (err) { console.error(err); } finally { setIsProvisioning(false); }
      };
      provision();
    }
  }, [isLoading, user, wallets, isProvisioning, firestore, userProfile, fetchWallets]);

  useEffect(() => {
    if (selectedQrAddress?.address) {
      QRCode.toDataURL(selectedQrAddress.address, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        .then(setQrDataUrl);
    }
  }, [selectedQrAddress]);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({ title: "Copied", description: "Address copied to clipboard." });
  };

  const handleSync = async (currency: string) => {
    if (syncingId) return;
    setSyncingId(currency);
    setSyncStep('Synchronizing ledger...');
    try {
      await new Promise(r => setTimeout(r, 1500));
      await syncWalletBalance(currency);
      toast({ title: "Updated", description: `${currency} balance refreshed.` });
    } catch (err) { console.error(err); } finally { setSyncingId(null); setSyncStep(''); }
  };

  const getChainType = (sym: string) => {
    if (['ETH', 'LINK', 'USDT', 'USDC', 'UNI'].includes(sym)) return 'ERC-20';
    if (['BNB'].includes(sym)) return 'BEP-20';
    if (sym === 'BTC') return 'Bitcoin';
    if (sym === 'SOL') return 'Solana';
    if (sym === 'ADA') return 'Cardano';
    return 'Native';
  };

  const openExplorer = (address: string, sym: string) => {
    setExplorerAddress(address); setExplorerCurrency(sym); setExplorerOpen(true);
  };

  const toggleTx = (currency: string) => {
    setExpandedTx(prev => {
      const next = new Set(prev);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
  };

  const totalPortfolioUSD = useMemo(() => {
    return wallets.reduce((sum, w) => sum + (w.balance * (livePrices[w.currency] || 0)), 0);
  }, [wallets, livePrices]);

  const kycStatus: KYCStatus = (userProfile?.kycStatus as KYCStatus) || 'NOT_SUBMITTED';

  return (
    <PrivateRoute>
      <div className="space-y-6 pb-20 md:pb-6">
        <div className="relative overflow-hidden rounded-3xl border border-violet-500/15 bg-violet-500/5 p-6 md:p-8">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-500 rounded-t-3xl" />
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-violet-400" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Secure Vaults</h1>
              </div>
              <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-white/25 ml-1">On-Chain Asset Management</p>
            </div>

            <div className="flex flex-col md:items-end gap-2">
              <p className="text-3xl md:text-4xl font-black tracking-tighter tabular-nums">{formatCurrency(totalPortfolioUSD * fiat.rate)}</p>
              <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-white/5" onClick={fetchWallets}>
                <RefreshCw className={cn("h-4 w-4 text-white/40", isLoading && "animate-spin text-primary")} />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl bg-white/[0.03] border border-white/[0.05]" />)
          ) : wallets.map((w) => {
            const priceUSD = livePrices[w.currency] || 0;
            const valueUSD = w.balance * priceUSD;
            const change = liveChanges[w.currency];
            const coinName = marketCoins.find(c => c.symbol === w.currency)?.name || w.currency;
            const isTxExpanded = expandedTx.has(w.currency);
            const hasBalance = w.balance > 0;

            return (
              <div key={w.id} className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0A0C12]/80 hover:border-violet-500/20 transition-all duration-300 group">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-violet-500/50 via-cyan-500/30 to-transparent" />
                <div className="absolute top-3 right-3 w-16 h-16 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-start justify-between p-5 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-11 w-11 rounded-2xl bg-white/[0.04] flex items-center justify-center ring-1 ring-white/[0.08]">
                      <CryptoIcon name={coinName} className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-white">{coinName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-white/30 font-semibold uppercase">{w.currency}</span>
                        <span className="text-[9px] text-white/15">{getChainType(w.currency)}</span>
                      </div>
                    </div>
                  </div>
                  {change !== undefined && (
                    <div className={cn("text-[10px] font-bold px-2 py-1 rounded-xl border", change >= 0 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-red-400 bg-red-500/10 border-red-500/20")}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </div>
                  )}
                </div>

                <div className="px-5 pb-5 space-y-4">
                  <div>
                    <p className="text-2xl font-bold tracking-tight tabular-nums text-white">{(w.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 4 })}</p>
                    <p className="text-sm text-white/30 font-medium">{formatCurrency(valueUSD * fiat.rate)}</p>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: Send, label: 'Send', action: 'send', href: `/send-receive?currency=${w.currency}&action=send` },
                      { icon: ArrowDownToLine, label: 'Receive', action: 'receive', href: `/send-receive?currency=${w.currency}&action=receive` },
                      { icon: ArrowLeftRight, label: 'Swap', action: 'swap', href: `/swap?from=${w.currency}` },
                      { icon: Banknote, label: 'Out', action: 'out', href: `/cash-out?currency=${w.currency}` }
                    ].map((act) => {
                      const isClickable = hasBalance || act.action === 'receive';
                      const isHighlighted = !hasBalance && act.action === 'receive';

                      return (
                        <Link
                          key={act.label}
                          href={isClickable ? act.href : '#'}
                          onClick={(e) => { if (!isClickable) e.preventDefault(); }}
                          className={cn(
                            "flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] transition-all group/act",
                            isClickable ? "hover:bg-violet-500/10 hover:border-violet-500/20" : "opacity-40 pointer-events-none",
                            isHighlighted && "border-violet-500/50 bg-violet-500/5 ring-1 ring-violet-500/30"
                          )}
                        >
                          <act.icon className={cn(
                            "h-4 w-4 transition-colors",
                            isClickable ? "text-white/70 group-hover/act:text-violet-300" : "text-white/50",
                            isHighlighted && "text-violet-400"
                          )} />
                          <span className={cn(
                            "text-[9px] font-semibold uppercase transition-colors",
                            isClickable ? "text-white/60 group-hover/act:text-violet-300" : "text-white/50",
                            isHighlighted && "text-violet-400"
                          )}>{act.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-white/[0.05]">
                  <button onClick={() => toggleTx(w.currency)} className="w-full flex items-center justify-between px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/60 hover:text-white transition-all">
                    <span>History</span>
                    {isTxExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isTxExpanded && <TransactionHistory walletCurrency={w.currency} userId={user!.uid} />}
                </div>

                <div className="flex gap-2 border-t border-white/[0.05] p-4 bg-black/20">
                  <Button variant="ghost" size="sm" className="flex-1 rounded-xl bg-white/[0.04] text-[9px] font-bold uppercase gap-2 text-white/70 hover:text-white" onClick={() => handleSync(w.currency)}>
                    <RefreshCw className={cn("h-3 w-3", syncingId === w.currency && "animate-spin")} /> {syncingId === w.currency ? 'Syncing' : 'Sync'}
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-white/[0.08] hover:border-violet-500/30 text-white/60 hover:text-violet-400" onClick={() => { setSelectedQrAddress({ address: w.address, currency: w.currency }); setIsQrOpen(true); }}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-white/[0.08] hover:border-cyan-500/30 text-white/60 hover:text-cyan-400" onClick={() => openExplorer(w.address, w.currency)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <KYCVerificationModal open={kycModalOpen} onOpenChange={setKycModalOpen} kycStatus={kycStatus} />
        <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
          <DialogContent className="max-w-xs border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/60">
            <DialogHeader>
              <DialogTitle className="text-center text-base font-bold text-white">
                {selectedQrAddress?.currency} Wallet QR
              </DialogTitle>
              <DialogDescription className="sr-only">Scan to send crypto to this wallet address.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="p-4 bg-white rounded-2xl shadow-lg">
                {qrDataUrl
                  ? <Image src={qrDataUrl} alt="Wallet QR Code" width={200} height={200} className="rounded-lg" />
                  : <div className="w-[200px] h-[200px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
                }
              </div>
              <div className="w-full p-3 bg-white/[0.04] border border-white/[0.07] rounded-xl">
                <code className="text-[10px] font-mono break-all block text-center text-white/50">{selectedQrAddress?.address}</code>
              </div>
              <button
                className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/50 hover:text-white/70 flex items-center justify-center gap-2 text-sm font-medium transition-all"
                onClick={() => {
                  if (selectedQrAddress?.address) {
                    navigator.clipboard.writeText(selectedQrAddress.address);
                    toast({ title: 'Address Copied', description: `${selectedQrAddress.currency} address copied to clipboard.` });
                  }
                }}
              >
                <Copy className="h-4 w-4" /> Copy Address
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={explorerOpen} onOpenChange={setExplorerOpen}>
          <DialogContent className="max-w-sm border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/60">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
                <Globe className="h-4 w-4 text-violet-400" /> Block Explorer
              </DialogTitle>
              <DialogDescription className="text-xs text-white/30">
                View on-chain data for this {explorerCurrency} address on the Apex ledger.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="p-3 bg-white/[0.04] border border-white/[0.07] rounded-xl">
                <code className="text-[10px] font-mono break-all block text-white/40">{explorerAddress}</code>
              </div>

              <Link
                href={`/explorer/${explorerAddress}?currency=${explorerCurrency}`}
                onClick={() => setExplorerOpen(false)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-violet-500/5 border border-violet-500/20 hover:bg-violet-500/10 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Globe className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-violet-300">Apex Block Explorer</p>
                    <p className="text-[10px] text-white/25">Live transactions · balance · network stats</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-violet-400/40 group-hover:text-violet-400 transition-colors shrink-0" />
              </Link>

              <button
                className="w-full h-10 rounded-xl text-xs text-white/25 hover:text-white/50 flex items-center justify-center gap-2 transition-all"
                onClick={() => { if (explorerAddress) { navigator.clipboard.writeText(explorerAddress); toast({ title: 'Address Copied' }); } }}
              >
                <Copy className="h-3 w-3" /> Copy Address
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PrivateRoute>
  );
}
