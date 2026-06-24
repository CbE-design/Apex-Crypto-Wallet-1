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
      // Naked query to bypass indexing issues
      const snap = await getDocs(collection(firestore, 'users', userId, 'wallets', walletCurrency, 'transactions'));
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as TransactionDoc));
      
      // Sort in frontend
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
          <div key={tx.id} className="flex items-center justify-between px-3 py-3 rounded-xl glass-module border border-white/[0.06]">
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

  // Provisioning if missing
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
        <div className="glass-module rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase italic">Secure Vaults</h1>
              </div>
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/40 ml-1">On-Chain Asset Management</p>
            </div>

            <div className="flex flex-col md:items-end gap-2">
              <div className="flex items-center gap-2">
                <Select value={fiat.symbol} onValueChange={setCurrency}>
                  <SelectTrigger className="h-7 w-[80px] text-[11px] bg-white/5 rounded-lg border-white/10 px-2 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-white/10">
                    {currencies.map(c => <SelectItem key={c.symbol} value={c.symbol} className="text-xs">{c.flag} {c.symbol}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-white/5" onClick={fetchWallets}>
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-primary")} />
                </Button>
              </div>
              <p className="text-3xl md:text-4xl font-black tracking-tighter tabular-nums">{formatCurrency(totalPortfolioUSD * fiat.rate)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-[32px] bg-white/5 border border-white/5" />)
          ) : wallets.map((w) => {
            const priceUSD = livePrices[w.currency] || 0;
            const valueUSD = w.balance * priceUSD;
            const change = liveChanges[w.currency];
            const coinName = marketCoins.find(c => c.symbol === w.currency)?.name || w.currency;
            const isTxExpanded = expandedTx.has(w.currency);

            return (
              <Card key={w.id} className="relative overflow-hidden glass-module border-white/5 hover:border-primary/20 transition-all duration-500 rounded-[32px]">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center ring-1 ring-white/10">
                      <CryptoIcon name={coinName} className="h-7 w-7" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">{coinName}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/60 font-black uppercase">{w.currency}</span>
                        <span className="text-[9px] text-muted-foreground/30 font-bold">{getChainType(w.currency)}</span>
                      </div>
                    </div>
                  </div>
                  {change !== undefined && (
                    <div className={cn("text-[10px] font-black px-2 py-1 rounded-full border", change >= 0 ? "text-green-400 bg-green-400/10 border-green-500/20" : "text-red-400 bg-red-400/10 border-red-500/20")}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-5 pt-0">
                  <div>
                    <p className="text-3xl font-black tracking-tight tabular-nums">{(w.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 4 })}</p>
                    <p className="text-sm text-muted-foreground/40 font-bold">{formatCurrency(valueUSD * fiat.rate)}</p>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: Send, label: 'Send', href: `/send-receive?currency=${w.currency}&action=send` },
                      { icon: ArrowDownToLine, label: 'Receive', href: `/send-receive?currency=${w.currency}&action=receive` },
                      { icon: ArrowLeftRight, label: 'Swap', href: `/swap?from=${w.currency}` },
                      { icon: Banknote, label: 'Out', href: `/cash-out?currency=${w.currency}` }
                    ].map((act, i) => (
                      <Link key={i} href={act.href} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-primary/10 hover:border-primary/20 transition-all group">
                         <act.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                         <span className="text-[9px] font-black uppercase text-muted-foreground/60">{act.label}</span>
                      </Link>
                    ))}
                  </div>
                </CardContent>

                <div className="border-t border-white/5">
                  <button onClick={() => toggleTx(w.currency)} className="w-full flex items-center justify-between px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-white transition-all">
                    <span>History</span>
                    {isTxExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {isTxExpanded && <TransactionHistory walletCurrency={w.currency} userId={user!.uid} />}
                </div>

                <CardFooter className="flex gap-2 border-t border-white/5 p-4 bg-black/20">
                   <Button variant="ghost" size="sm" className="flex-1 rounded-xl bg-white/5 text-[9px] font-black uppercase gap-2" onClick={() => handleSync(w.currency)}>
                     <RefreshCw className={cn("h-3 w-3", syncingId === w.currency && "animate-spin")} /> {syncingId === w.currency ? 'Syncing' : 'Sync Ledger'}
                   </Button>
                   <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-white/10" onClick={() => { setSelectedQrAddress({ address: w.address, currency: w.currency }); setIsQrOpen(true); }}><QrCode className="h-4 w-4" /></Button>
                   <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-white/10" onClick={() => openExplorer(w.address, w.currency)}><ExternalLink className="h-4 w-4" /></Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <KYCVerificationModal open={kycModalOpen} onOpenChange={setKycModalOpen} kycStatus={kycStatus} />

        {/* QR Code Dialog */}
        <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
          <DialogContent className="max-w-xs rounded-2xl bg-card border-border/60">
            <DialogHeader>
              <DialogTitle className="text-center text-base font-bold">
                {selectedQrAddress?.currency} Wallet QR
              </DialogTitle>
              <DialogDescription className="sr-only">Scan to send crypto to this wallet address.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="p-4 bg-white rounded-2xl shadow-lg">
                {qrDataUrl
                  ? <Image src={qrDataUrl} alt="Wallet QR Code" width={200} height={200} className="rounded-lg" />
                  : <div className="w-[200px] h-[200px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                }
              </div>
              <div className="w-full p-3 bg-muted/20 border border-border/40 rounded-xl">
                <code className="text-[10px] font-mono break-all block text-center text-muted-foreground">{selectedQrAddress?.address}</code>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-xl gap-2 text-sm font-medium"
                onClick={() => {
                  if (selectedQrAddress?.address) {
                    navigator.clipboard.writeText(selectedQrAddress.address);
                    toast({ title: 'Address Copied', description: `${selectedQrAddress.currency} address copied to clipboard.` });
                  }
                }}
              >
                <Copy className="h-4 w-4" /> Copy Address
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Block Explorer Dialog */}
        <Dialog open={explorerOpen} onOpenChange={setExplorerOpen}>
          <DialogContent className="max-w-sm rounded-2xl bg-card border-border/60">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Block Explorer
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                View {explorerCurrency} on-chain data for this address.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="p-3 bg-muted/20 border border-border/40 rounded-xl">
                <code className="text-[10px] font-mono break-all block text-muted-foreground">{explorerAddress}</code>
              </div>
              {(() => {
                const addr = explorerAddress || '';
                const sym = explorerCurrency || '';
                const links: { label: string; url: string }[] = [];
                if (['ETH', 'LINK', 'USDT', 'USDC', 'UNI'].includes(sym)) {
                  links.push({ label: 'Etherscan', url: `https://etherscan.io/address/${addr}` });
                } else if (sym === 'BNB') {
                  links.push({ label: 'BscScan', url: `https://bscscan.com/address/${addr}` });
                } else if (sym === 'BTC') {
                  links.push({ label: 'Blockchain.com', url: `https://www.blockchain.com/explorer/addresses/btc/${addr}` });
                  links.push({ label: 'Mempool.space', url: `https://mempool.space/address/${addr}` });
                } else if (sym === 'SOL') {
                  links.push({ label: 'Solscan', url: `https://solscan.io/address/${addr}` });
                } else if (sym === 'ADA') {
                  links.push({ label: 'Cardanoscan', url: `https://cardanoscan.io/address/${addr}` });
                } else {
                  links.push({ label: 'Etherscan', url: `https://etherscan.io/address/${addr}` });
                }
                return links.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors group"
                  >
                    <span className="text-sm font-medium text-primary">{link.label}</span>
                    <ExternalLink className="h-4 w-4 text-primary/60 group-hover:text-primary transition-colors" />
                  </a>
                ));
              })()}
              <Button
                variant="ghost"
                className="w-full rounded-xl text-xs text-muted-foreground gap-2"
                onClick={() => { if (explorerAddress) { navigator.clipboard.writeText(explorerAddress); toast({ title: 'Address Copied' }); } }}
              >
                <Copy className="h-3 w-3" /> Copy Address
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PrivateRoute>
  );
}

