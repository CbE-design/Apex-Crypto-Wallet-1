'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { CryptoIcon } from '../crypto-icon';
import { cn, formatAppTime } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/currency-context';
import { useLivePrices } from '@/hooks/use-live-prices';
import { AlertTriangle, History, X, CheckCircle2 } from 'lucide-react';
import type { Transaction } from '@/lib/types';

type EnrichedTransaction = Transaction & { pricePerCoinUSD: number };

function TransactionRow({
  tx,
  onSelect,
  priceError,
}: {
  tx: EnrichedTransaction;
  onSelect: () => void;
  priceError: boolean;
}) {
  const { formatCurrency } = useCurrency();

  // 1. Correct Debit (-) vs Credit (+) logic
  const typeLower = (tx.type || '').toLowerCase();
  const isDebit =
    typeLower === 'sell' ||
    typeLower === 'withdrawal' ||
    typeLower === 'transfer_sent' ||
    typeLower.includes('sent') ||
    typeLower.includes('withdraw');

  // 2. Safe calculation preventing ZARNaN
  const rawAmount = Number(tx.amount || 0);
  const safeAmount = isNaN(rawAmount) ? 0 : rawAmount;

  const price = Number(tx.pricePerCoinUSD);
  const safePrice = isNaN(price) || price <= 0 ? 1 : price;
  const value = safeAmount * safePrice;

  // 3. Safe date formatting for Firestore Timestamps and ISO strings
  let dateObj = new Date();
  if (tx.timestamp && typeof (tx as any).timestamp.toDate === 'function') {
    dateObj = (tx as any).timestamp.toDate();
  } else if (tx.timestamp) {
    dateObj = new Date(tx.timestamp as any);
  } else if ((tx as any).createdAt) {
    dateObj = new Date((tx as any).createdAt);
  }

  return (
    <div
      onClick={onSelect}
      className="grid grid-cols-2 sm:grid-cols-[auto_1fr_auto_auto_auto] gap-2 sm:gap-3 px-4 sm:px-5 py-3 items-center text-xs sm:text-sm transition-colors hover:bg-white/[0.04] cursor-pointer border-b border-white/[0.02] last:border-0"
    >
      <div className="hidden sm:block pl-1 pr-2">
        <div
          className={cn(
            'h-3.5 w-3.5 rounded-full border-2',
            isDebit ? 'border-red-500 bg-red-500/30' : 'border-emerald-500 bg-emerald-500/30'
          )}
        />
      </div>

      <div className="font-semibold">
        <p className="capitalize text-zinc-100 truncate">{tx.type || 'Transfer'}</p>
        <p className="text-[11px] font-mono text-muted-foreground">{formatAppTime(dateObj)}</p>
      </div>

      <div className="flex items-center gap-1.5 font-medium text-zinc-300">
        <CryptoIcon name={tx.currency || 'USD'} className="h-4 w-4 sm:h-5 sm:w-5" />
        <span>{tx.currency || 'USD'}</span>
      </div>

      <div className={cn('font-mono text-right font-medium', isDebit ? 'text-red-400' : 'text-emerald-400')}>
        {isDebit ? '-' : '+'} {safeAmount < 1 ? safeAmount.toFixed(6) : safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
      </div>

      <div className={cn('text-right font-semibold tabular-nums text-zinc-200', priceError && 'text-muted-foreground/60')}>
        {formatCurrency(value)}
      </div>
    </div>
  );
}

export function TransactionHistory() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedTx, setSelectedTx] = React.useState<EnrichedTransaction | null>(null);

  const txQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'transactions'), orderBy('timestamp', 'desc'), limit(50));
  }, [user, firestore]);

  const { data: transactions, isLoading: isTxLoading } = useCollection<Transaction>(txQuery);

  const transactionSymbols = React.useMemo(
    () => (transactions ? [...new Set(transactions.map((tx) => tx.currency).filter(Boolean))] : []),
    [transactions]
  );

  const { prices, error: priceError } = useLivePrices(transactionSymbols);

  const enrichedTransactions = React.useMemo(() => {
    return transactions?.map((tx) => ({
      ...tx,
      pricePerCoinUSD: prices[tx.currency] ?? 1,
    }));
  }, [transactions, prices]);

  const isLoading = isTxLoading || (transactionSymbols.length > 0 && Object.keys(prices).length === 0 && !priceError);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0A0C12]/60 backdrop-blur-sm h-full flex flex-col justify-between">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 to-violet-500" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white">Recent Transactions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Latest activity across all wallets</p>
        </div>
        {priceError && (
          <div className="p-2 bg-destructive/10 rounded-full" title="Price feed error">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
        )}
      </div>

      {/* Column Headers */}
      <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-5 py-2 border-b border-white/[0.04]">
        {['', 'Type', 'Asset', 'Amount', 'Value'].map((h, i) => (
          <span
            key={i}
            className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 last:text-right"
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="overflow-y-auto max-h-[320px] scroll-container divide-y divide-white/[0.02]">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-5 py-3 items-center">
              <div className="hidden sm:block pl-1 pr-2">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
              </div>
              <div>
                <Skeleton className="h-4 w-20 sm:w-24" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 sm:h-5 sm:w-5 rounded-full" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-4 w-16 sm:w-20 ml-auto" />
              <Skeleton className="h-4 w-14 sm:w-16 ml-auto" />
            </div>
          ))
        ) : enrichedTransactions && enrichedTransactions.length > 0 ? (
          enrichedTransactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onSelect={() => setSelectedTx(tx)}
              priceError={!!priceError}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
            <History className="h-9 w-9 text-muted-foreground/30 mb-2" />
            <h4 className="text-sm font-semibold text-white">No recent activity found</h4>
            <p className="text-xs text-muted-foreground/70">Your latest transactions will appear here.</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12151E] border border-white/10 w-full max-w-sm sm:max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-white">Transaction Details</h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-zinc-300 truncate max-w-[180px]">{selectedTx.id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-white capitalize">{selectedTx.type}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-muted-foreground">Asset / Currency</span>
                <span className="font-medium text-white">{selectedTx.currency}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono font-semibold text-white">
                  {selectedTx.amount} {selectedTx.currency}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  {selectedTx.status || 'COMPLETED'}
                </span>
              </div>
              {(selectedTx as any).description && (
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-muted-foreground">Description</span>
                  <span className="text-zinc-300 truncate max-w-[180px]">{(selectedTx as any).description}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedTx(null)}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs sm:text-sm font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
