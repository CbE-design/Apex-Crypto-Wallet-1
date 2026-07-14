'use client';

import * as React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Download,
  Repeat,
  ArrowRight,
  MoreHorizontal,
  Plus,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useLivePrices } from '@/hooks/use-live-prices';
import { useCurrency } from '@/context/currency-context';
import { CryptoIcon } from '@/components/crypto-icon';
import { Skeleton } from '@/components/ui/skeleton';
import type { PortfolioAsset, Transaction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';

interface WalletDoc {
  id: string; // Asset symbol e.g. BTC
  balance: number;
  currency: string;
}

interface TransactionDoc extends Transaction {
  id: string;
}

export default function MyWalletsPage() {
  const { user } = useWallet();
  const firestore = useFirestore();
  const { formatCurrency, currency: nativeCurrency } = useCurrency();
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);

  const { data: walletData, isLoading: isWalletLoading } = useCollection<WalletDoc>(walletsQuery);

  const symbols = React.useMemo(() => {
    if (!walletData) return [];
    return walletData.map(w => w.currency);
  }, [walletData]);

  const { prices, changes, isLoading: isPriceLoading } = useLivePrices(symbols);

  const isLoading = isWalletLoading || (isPriceLoading && symbols.length > 0);

  const assets: PortfolioAsset[] = React.useMemo(() => {
    if (!walletData) return [];
    return walletData.map(walletDoc => {
      const priceUSD = prices[walletDoc.currency] ?? 0;
      const change24h = changes[walletDoc.currency] ?? 0;
      return {
        symbol: walletDoc.currency,
        name: walletDoc.currency,
        amount: walletDoc.balance,
        valueUSD: walletDoc.balance * priceUSD,
        priceUSD,
        change24h,
        icon: '',
      };
    });
  }, [walletData, prices, changes]);

  const sortedAssets = React.useMemo(
    () => [...assets].sort((a, b) => b.valueUSD - a.valueUSD),
    [assets]
  );

  const totalValueUSD = React.useMemo(() => assets.reduce((sum, asset) => sum + asset.valueUSD, 0), [assets]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
  }, [user, firestore]);

  const { data: transactions, isLoading: isTxLoading } = useCollection<TransactionDoc>(transactionsQuery);

  const sortedTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return [...transactions].sort((a, b) => {
      const t1 = a.timestamp?.toMillis?.() ?? ((a.timestamp?.seconds ?? 0) * 1000);
      const t2 = b.timestamp?.toMillis?.() ?? ((b.timestamp?.seconds ?? 0) * 1000);
      return t2 - t1;
    });
  }, [transactions]);

  const AssetCard = ({ asset }: { asset: PortfolioAsset }) => {
    const isWalletEmpty = asset.amount === 0;

    const actionButtons = [
      { label: 'Send', icon: Send, disabled: isWalletEmpty },
      { label: 'Receive', icon: Download, accent: isWalletEmpty },
      { label: 'Swap', icon: Repeat, disabled: isWalletEmpty },
      { label: 'Withdraw', icon: ArrowRight, disabled: isWalletEmpty },
    ];

    return (
      <div className="bg-[#0A0C12]/80 border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between group hover:border-violet-500/20 transition-all">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <CryptoIcon name={asset.symbol} className="w-9 h-9" />
            <div>
              <p className="font-bold text-white text-base">{asset.name}</p>
              <p className="text-xs text-white/40 font-mono">{asset.symbol}</p>
            </div>
          </div>
          <div className="text-right">
             <p className="font-bold text-white text-base">{formatCurrency(asset.valueUSD)}</p>
            <div className={cn('text-xs font-bold flex items-center justify-end gap-1', asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {asset.change24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{Math.abs(asset.change24h).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-white/[0.05]">
           <p className="text-sm text-white/80 font-mono">{asset.amount.toFixed(6)} {asset.symbol}</p>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {actionButtons.map(({ label, icon: Icon, disabled, accent }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                className={cn(
                  'flex-1 flex flex-col items-center justify-center h-16 rounded-xl bg-white/[0.03] border-white/[0.06] hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-500/30 transition-all text-white/50',
                  disabled && 'opacity-40 pointer-events-none',
                  accent && 'border-violet-500/40 bg-violet-500/5 text-violet-400 ring-1 ring-violet-500/20'
                )}
                disabled={disabled}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span className="text-[10px] font-semibold uppercase">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const TransactionRow = ({ tx }: { tx: TransactionDoc }) => (
    <div className="grid grid-cols-4 gap-4 items-center px-4 py-3 text-xs border-b border-white/[0.05] last:border-b-0 hover:bg-violet-500/[0.03] transition-colors">
      <div className="flex items-center gap-3">
        <CryptoIcon name={tx.currency} className="w-7 h-7" />
        <div>
          <p className="font-semibold text-white/80">{tx.currency}</p>
          <p className="text-[10px] text-white/30">{new Date(tx.timestamp?.seconds * 1000).toLocaleDateString()}</p>
        </div>
      </div>
      <p className={cn(
        "font-semibold",
        tx.type === 'Buy' ? 'text-emerald-400' : 'text-red-400'
      )}>
        {tx.type === 'Buy' ? '+' : '-'} {tx.amount.toFixed(6)}
      </p>
      <p className="font-mono text-white/40">{formatCurrency((tx as any).valueUSD)}</p>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-white/40 hover:text-white">
          Details
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 p-4 md:p-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Wallet className="h-5 w-5 text-violet-400" />
            </div>
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Portfolio</h1>
                <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-white/25 ml-px">
                    Asset Management
                </p>
            </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white tabular-nums tracking-tighter">{formatCurrency(totalValueUSD)}</p>
          <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">Total Balance</p>
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <Button size="icon" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} onClick={() => setViewMode('grid')} className="h-7 w-7 rounded-lg">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button size="icon" variant={viewMode === 'list' ? 'secondary' : 'ghost'} onClick={() => setViewMode('list')} className="h-7 w-7 rounded-lg">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
             <div key={i} className="bg-[#0A0C12]/80 border border-white/[0.07] rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded-full" />
                        <div className="space-y-2">
                           <Skeleton className="h-4 w-20" />
                           <Skeleton className="h-3 w-10" />
                        </div>
                    </div>
                    <div className="space-y-2 text-right">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-12 ml-auto" />
                    </div>
                </div>
                <div className="mt-5 pt-5 border-t border-white/[0.05] space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <div className="grid grid-cols-4 gap-2">
                       <Skeleton className="h-16 rounded-xl" />
                       <Skeleton className="h-16 rounded-xl" />
                       <Skeleton className="h-16 rounded-xl" />
                       <Skeleton className="h-16 rounded-xl" />
                    </div>
                </div>
            </div>
          ))}
        </div>
      ) : sortedAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center bg-white/[0.02] rounded-2xl p-16 border border-white/[0.07] border-dashed">
          <div className="p-4 rounded-full bg-violet-500/10 mb-4 ring-8 ring-violet-500/5"><Wallet className="h-8 w-8 text-violet-400"/></div>
          <h4 className="text-lg font-semibold text-white mb-1">No Assets Yet</h4>
          <p className="text-sm text-white/40 max-w-xs mx-auto">Your wallet balances will appear here once you deposit funds. Click below to get started.</p>
          <Link href="/add-asset">
             <Button className="mt-6 h-11 rounded-xl gap-2 bg-gradient-to-r from-violet-500 to-cyan-400 text-white font-bold">
                <Plus className="h-4 w-4"/> Deposit Funds
            </Button>
          </Link>
        </div>
      ) : (
        <div className={cn(
            "grid gap-6",
            viewMode === 'grid' ? "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
        )}>
          {sortedAssets.map((asset) => (
             viewMode === 'grid' ? (
              <AssetCard key={asset.symbol} asset={asset} />
            ) : (
                <div key={asset.symbol} className="bg-[#0A0C12]/80 border border-white/[0.07] rounded-2xl px-5 py-4 flex items-center justify-between group hover:border-violet-500/20 transition-all">
                <div className="flex items-center gap-4">
                  <CryptoIcon name={asset.symbol} className="w-9 h-9" />
                  <div>
                    <p className="font-bold text-white">{asset.name}</p>
                    <p className="text-sm text-white/40 font-mono">
                      {asset.amount.toFixed(6)} {asset.symbol}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                    <div className="text-right">
                        <p className="font-semibold text-white">{formatCurrency(asset.valueUSD)}</p>
                         <div className={cn('text-xs font-bold flex items-center justify-end gap-1', asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {asset.change24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          <span>{Math.abs(asset.change24h).toFixed(2)}%</span>
                        </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full data-[state=open]:bg-violet-500/10 text-white/50 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800 text-white">
                        <DropdownMenuItem>Send</DropdownMenuItem>
                        <DropdownMenuItem>Receive</DropdownMenuItem>
                        <DropdownMenuItem>Swap</DropdownMenuItem>
                        <DropdownMenuItem>Withdraw</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <div className="mt-12">
        <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
         <div className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80">
          <div className="grid grid-cols-4 gap-4 items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/30 border-b border-white/[0.05]">
            <span>Asset</span>
            <span>Amount</span>
            <span>Value ({nativeCurrency.symbol})</span>
            <span className="text-right">Action</span>
          </div>
          {isTxLoading ? (
            <div className="py-10 flex justify-center"><Skeleton className="h-6 w-6" /></div>
          ) : sortedTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-white/30">No transactions yet.</p>
            </div>
          ) : (
            sortedTransactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </div>
      </div>
    </div>
  );
}
