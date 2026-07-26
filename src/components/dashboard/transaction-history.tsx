'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { CryptoIcon } from '../crypto-icon';
import { cn, formatAppTime } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/currency-context';
import { useLivePrices } from '@/hooks/use-live-prices';
import { AlertTriangle, History } from 'lucide-react';
import type { Transaction } from '@/lib/types';

type EnrichedTransaction = Transaction & { pricePerCoinUSD: number };

function TransactionRow({ tx, onHover, priceError }: { tx: EnrichedTransaction; onHover: () => void; priceError: boolean }) {
  const { formatCurrency } = useCurrency();
  const isDebit = tx.type === 'Sell' || tx.type === 'Withdrawal';
  const value = tx.amount * tx.pricePerCoinUSD;

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-5 py-3 items-center text-sm transition-colors hover:bg-white/[0.03]" onMouseEnter={onHover}>
      <div className="pl-1 pr-3">
        <div className={cn(
          "h-3.5 w-3.5 rounded-full border-2",
          isDebit ? "border-red-500 bg-red-500/30" : "border-emerald-500 bg-emerald-500/30"
        )} />
      </div>
      <div className="font-semibold">
        <p className="capitalize">{tx.type}</p>
        <p className="text-[11px] font-mono text-muted-foreground">{formatAppTime(tx.timestamp.toDate())}</p>
      </div>
      <div className="flex items-center gap-2 font-medium">
        <CryptoIcon name={tx.currency} className="h-5 w-5" />
        {tx.currency}
      </div>
      <div className={cn('font-mono text-right', isDebit ? 'text-red-400' : 'text-emerald-400')}>
        {isDebit ? '-' : '+'} {tx.amount.toFixed(6)}
      </div>
      <div className={cn('text-right font-semibold tabular-nums', priceError && 'text-muted-foreground/60')}>
        {formatCurrency(value)}
      </div>
    </div>
  );
}

export function TransactionHistory() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [hoveredTx, setHoveredTx] = React.useState<string | null>(null);

  const txQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'transactions'), orderBy('timestamp', 'desc'), limit(50));
  }, [user, firestore]);

  const { data: transactions, isLoading: isTxLoading } = useCollection<Transaction>(txQuery);

  const transactionSymbols = React.useMemo(() => transactions ? [...new Set(transactions.map(tx => tx.currency))] : [], [transactions]);
  const { prices, error: priceError } = useLivePrices(transactionSymbols);

  const enrichedTransactions = React.useMemo(() => {
    return transactions?.map(tx => ({
      ...tx,
      pricePerCoinUSD: prices[tx.currency] ?? 0,
    }));
  }, [transactions, prices]);

  const isLoading = isTxLoading || (transactionSymbols.length > 0 && Object.keys(prices).length === 0 && !priceError);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0A0C12]/60 backdrop-blur-sm h-full">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 to-violet-500" />
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-base font-semibold text-white">Recent Transactions</h3>
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
      <div className="overflow-y-auto max-h-[295px] scroll-container">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-5 py-3 items-center">
              <div className="pl-1 pr-3"><Skeleton className="h-3.5 w-3.5 rounded-full" /></div>
              <div><Skeleton className="h-4 w-24" /></div>
              <div className="flex items-center gap-2"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-12" /></div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
          ))
        ) : enrichedTransactions && enrichedTransactions.length > 0 ? (
          enrichedTransactions.map(tx => (
            <TransactionRow key={tx.id} tx={tx} onHover={() => setHoveredTx(tx.id)} priceError={!!priceError} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <History className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h4 className="text-sm font-semibold text-white">No recent activity found</h4>
            <p className="text-xs text-muted-foreground/70">Your latest transactions will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
