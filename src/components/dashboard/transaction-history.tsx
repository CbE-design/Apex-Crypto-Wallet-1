
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import { useCurrency } from '@/context/currency-context';
import { CryptoIcon } from '../crypto-icon';
import { Loader2, Inbox, AlertTriangle, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Building2, Send } from 'lucide-react';
import { marketCoins } from '@/lib/data';
import { useLivePrices } from '@/hooks/use-live-prices';

interface Transaction {
  id: string;
  type: 'Buy' | 'Sell' | 'Send' | 'Withdrawal' | 'Swap' | 'Internal Transfer';
  amount: number;
  price: number;
  currency: string;
  timestamp: any;
  status: 'Completed' | 'Pending' | 'Failed' | 'Reconciling';
  notes?: string;
  sender?: string;
  recipient?: string;
  txHash?: string;
  userId?: string;
}

function generateTxHash(id: string): string {
  const seed = id + 'apex';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += ((seed.charCodeAt(i % seed.length) + i * 7) % 16).toString(16);
  }
  return '0x' + hash;
}

const INCOMING_TYPES = new Set(['Buy', 'Internal Transfer']);

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  Buy:               { icon: <ArrowDownLeft className="h-3.5 w-3.5" />, bg: 'bg-cyan-500/12 border-cyan-500/20',       text: 'text-cyan-400' },
  Sell:              { icon: <ArrowUpRight  className="h-3.5 w-3.5" />, bg: 'bg-red-500/12 border-red-500/20',         text: 'text-red-400' },
  Send:              { icon: <Send          className="h-3.5 w-3.5" />, bg: 'bg-red-500/12 border-red-500/20',         text: 'text-red-400' },
  Withdrawal:        { icon: <Building2     className="h-3.5 w-3.5" />, bg: 'bg-orange-500/12 border-orange-500/20',   text: 'text-orange-400' },
  Swap:              { icon: <ArrowLeftRight className="h-3.5 w-3.5" />, bg: 'bg-violet-500/12 border-violet-500/20',  text: 'text-violet-400' },
  'Internal Transfer': { icon: <ArrowDownLeft className="h-3.5 w-3.5" />, bg: 'bg-cyan-500/12 border-cyan-500/20',   text: 'text-cyan-400' },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; text: string }> = {
  Completed:   { dot: 'bg-emerald-400', label: 'Confirmed', text: 'text-emerald-400' },
  Pending:     { dot: 'bg-orange-400 animate-pulse', label: 'Pending', text: 'text-orange-400' },
  Failed:      { dot: 'bg-red-400', label: 'Failed', text: 'text-red-400' },
  Reconciling: { dot: 'bg-blue-400 animate-pulse', label: 'Reconciling', text: 'text-blue-400' },
};

export function TransactionHistory() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { currency, formatCurrency } = useCurrency();

  const transactionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(50),
    );
  }, [user, firestore]);

  const { data: rawTransactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const transactions = React.useMemo(() => {
    if (!rawTransactions) return null;
    return [...rawTransactions]
      .sort((a, b) => {
        const aMs = a.timestamp?.toMillis?.() ?? (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
        const bMs = b.timestamp?.toMillis?.() ?? (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
        return bMs - aMs;
      })
      .slice(0, 25);
  }, [rawTransactions]);

  const transactionSymbols = React.useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map(t => t.currency).filter(Boolean))];
  }, [transactions]);

  const { prices: livePrices, error: priceError } = useLivePrices(transactionSymbols);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card/60 backdrop-blur-sm h-full">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-cyan-400 to-violet-600" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-base font-semibold text-foreground">Recent Transactions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Latest activity across all wallets</p>
        </div>
        {priceError && (
          <div className="p-2 bg-destructive/10 rounded-full">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-5 py-2 border-b border-white/[0.04]">
        {['', 'Type', 'Asset', 'Amount', 'Status'].map(h => (
          <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 last:text-right">{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="overflow-y-auto max-h-[420px] scroll-container">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : transactions && transactions.length > 0 ? (
          transactions.map((tx) => {
            const sym = tx.currency;
            const coinName = marketCoins.find(c => c.symbol === sym)?.name || sym;
            const priceUSD = tx.price > 0 ? tx.price : (livePrices[sym] || 0);
            const valueInCurrency = tx.amount * priceUSD * currency.rate;
            const txHash = tx.txHash || generateTxHash(tx.id);
            const isIncoming = INCOMING_TYPES.has(tx.type);
            const typeConf = TYPE_CONFIG[tx.type] ?? TYPE_CONFIG['Swap'];
            const statusConf = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG['Pending'];

            return (
              <div key={tx.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group cursor-pointer">
                {/* Type icon */}
                <div className={cn('p-2 rounded-lg border shrink-0', typeConf.bg, typeConf.text)}>
                  {typeConf.icon}
                </div>

                {/* Type + hash */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{tx.type}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 truncate">
                    {txHash.substring(0, 8)}…{txHash.substring(txHash.length - 4)}
                  </p>
                </div>

                {/* Asset */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <CryptoIcon name={coinName} className="h-5 w-5" />
                  <span className="text-xs font-medium text-muted-foreground">{sym}</span>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-semibold tabular-nums', isIncoming ? 'text-emerald-400' : 'text-foreground', priceError && 'text-muted-foreground/60')}>
                    {isIncoming ? '+' : '-'}{(tx.amount ?? 0).toFixed(sym === 'BTC' ? 6 : 4)} {sym}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/60">
                    {priceError ? 'N/A' : valueInCurrency > 0 ? formatCurrency(valueInCurrency) : '—'}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <div className={cn('h-1.5 w-1.5 rounded-full', statusConf.dot)} />
                  <span className={cn('text-[11px] font-medium', statusConf.text)}>{statusConf.label}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-25" />
            <p className="text-sm">No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
