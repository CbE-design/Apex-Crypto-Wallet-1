'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { AdminRoute } from '@/components/admin/admin-route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CryptoIcon } from '@/components/crypto-icon';
import { marketCoins } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Waves, Plus, Minus, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLivePrices } from '@/hooks/use-live-prices';
import { useCurrency } from '@/context/currency-context';

interface WhaleBalances { [symbol: string]: number }

function BalanceRow({
  symbol, balance, priceUSD, change, formatCurrency, fiatRate,
  onTopUp, onDeduct
}: {
  symbol: string; balance: number; priceUSD: number; change: number;
  formatCurrency: (n: number) => string; fiatRate: number;
  onTopUp: (sym: string) => void; onDeduct: (sym: string) => void;
}) {
  const coinName = marketCoins.find(c => c.symbol === symbol)?.name || symbol;
  const valueUSD = balance * priceUSD;
  const isLow = balance < 1 && balance > 0;
  const isEmpty = balance === 0;

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-2xl border transition-all group",
      isEmpty ? "border-red-500/15 bg-red-500/5" :
      isLow ? "border-amber-500/15 bg-amber-500/5" :
      "border-white/[0.06] bg-white/[0.02] hover:border-violet-500/15 hover:bg-violet-500/[0.03]"
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative">
          <CryptoIcon name={coinName} className="h-9 w-9 shrink-0" />
          {isEmpty && <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-[#050709]" />}
          {isLow && !isEmpty && <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-500 border-2 border-[#050709] animate-pulse" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">{symbol}</p>
            <span className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded-md',
              change >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
            )}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
          <p className="text-[11px] text-white/30 tabular-nums font-mono">
            {balance.toFixed(symbol === 'BTC' ? 8 : 6)} {symbol}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0 hidden sm:block">
        <p className={cn("text-sm font-bold tabular-nums", isEmpty ? "text-red-400" : isLow ? "text-amber-400" : "text-white/80")}>
          {formatCurrency(valueUSD)}
        </p>
        <p className="text-[10px] text-white/25">
          {priceUSD > 0 ? `@ ${formatCurrency(priceUSD)}` : 'No price'}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onTopUp(symbol)}
          className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-all hover:scale-105"
          title={`Top up ${symbol}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDeduct(symbol)}
          disabled={balance <= 0}
          className="h-8 w-8 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Deduct ${symbol}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function WhaleAdminPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { formatCurrency, currency } = useCurrency();
  const [balances, setBalances] = useState<WhaleBalances>({});
  const [isLoading, setIsLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);

  const [modalMode, setModalMode] = useState<'topup' | 'deduct' | null>(null);
  const [modalSymbol, setModalSymbol] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalNote, setModalNote] = useState('');

  const symbols = marketCoins.map(c => c.symbol);
  const { prices, changes, isLoading: priceLoading } = useLivePrices(symbols);

  const fetchBalances = useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    try {
      const ref = doc(firestore, 'whale_treasury', 'balances');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setBalances(snap.data() as WhaleBalances);
      } else {
        // Initialize with zeros for all coins
        const initial: WhaleBalances = {};
        marketCoins.forEach(c => { initial[c.symbol] = 0; });
        setBalances(initial);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const openModal = (mode: 'topup' | 'deduct', sym: string) => {
    setModalMode(mode);
    setModalSymbol(sym);
    setModalAmount('');
    setModalNote('');
  };

  const closeModal = () => { setModalMode(null); setModalSymbol(''); setModalAmount(''); setModalNote(''); };

  const executeAdjustment = async () => {
    if (!firestore || !modalSymbol || !modalAmount) return;
    const amount = parseFloat(modalAmount);
    if (isNaN(amount) || amount <= 0) return;

    setAdjusting(true);
    try {
      const ref = doc(firestore, 'whale_treasury', 'balances');
      const current = balances[modalSymbol] ?? 0;
      const newBalance = modalMode === 'topup' ? current + amount : Math.max(0, current - amount);

      await setDoc(ref, {
        ...balances,
        [modalSymbol]: newBalance,
        lastUpdated: serverTimestamp(),
      });

      // Log the treasury operation
      await addDoc(collection(firestore, 'whale_treasury_log'), {
        symbol: modalSymbol,
        mode: modalMode,
        amount,
        previousBalance: current,
        newBalance,
        note: modalNote,
        timestamp: serverTimestamp(),
      });

      setBalances(prev => ({ ...prev, [modalSymbol]: newBalance }));
      toast({
        title: modalMode === 'topup' ? `Topped up ${modalSymbol}` : `Deducted ${modalSymbol}`,
        description: `${modalMode === 'topup' ? '+' : '-'}${amount} ${modalSymbol} → new balance: ${newBalance.toFixed(6)}`,
      });
      closeModal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAdjusting(false);
    }
  };

  const totalUSD = Object.entries(balances).reduce((sum, [sym, bal]) => {
    return sum + (bal * (prices[sym] || 0));
  }, 0);

  const emptyCoins = Object.entries(balances).filter(([, b]) => b === 0).length;
  const lowCoins = Object.entries(balances).filter(([, b]) => b > 0 && b < 1).length;

  return (
    <AdminRoute>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <Waves className="h-5 w-5 text-cyan-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Whale Treasury</h1>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">
              Apex Explorer Reserve · All direct-sends debit here
            </p>
          </div>
          <button
            onClick={fetchBalances}
            className="h-9 w-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 transition-all hover:border-violet-500/20"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Total Value', value: isLoading ? '—' : formatCurrency(totalUSD),
              color: 'text-violet-300', accent: 'border-violet-500/15 bg-violet-500/5',
            },
            {
              label: 'Assets Tracked', value: String(Object.keys(balances).length),
              color: 'text-cyan-300', accent: 'border-cyan-500/15 bg-cyan-500/5',
            },
            {
              label: 'Empty Vaults', value: String(emptyCoins),
              color: emptyCoins > 0 ? 'text-red-400' : 'text-white/40',
              accent: emptyCoins > 0 ? 'border-red-500/15 bg-red-500/5' : 'border-white/[0.06] bg-white/[0.02]',
            },
            {
              label: 'Low Vaults', value: String(lowCoins),
              color: lowCoins > 0 ? 'text-amber-400' : 'text-white/40',
              accent: lowCoins > 0 ? 'border-amber-500/15 bg-amber-500/5' : 'border-white/[0.06] bg-white/[0.02]',
            },
          ].map(kpi => (
            <div key={kpi.label} className={cn("rounded-2xl border p-4", kpi.accent)}>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-1.5">{kpi.label}</p>
              <p className={cn("text-xl font-bold tabular-nums", kpi.color)}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Balance grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {marketCoins.map(coin => (
              <BalanceRow
                key={coin.symbol}
                symbol={coin.symbol}
                balance={balances[coin.symbol] ?? 0}
                priceUSD={prices[coin.symbol] || 0}
                change={changes[coin.symbol] ?? 0}
                formatCurrency={formatCurrency}
                fiatRate={currency.rate}
                onTopUp={(sym) => openModal('topup', sym)}
                onDeduct={(sym) => openModal('deduct', sym)}
              />
            ))}
          </div>
        )}

        {/* Adjustment Modal */}
        {modalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
            <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0A0C12] p-6 space-y-5 shadow-2xl shadow-black/50">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-2xl bg-gradient-to-r from-violet-500 to-cyan-500" />

              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-xl border",
                  modalMode === 'topup'
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-red-500/10 border-red-500/20"
                )}>
                  {modalMode === 'topup'
                    ? <Plus className="h-4 w-4 text-emerald-400" />
                    : <Minus className="h-4 w-4 text-red-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{modalMode === 'topup' ? 'Top up' : 'Deduct'} {modalSymbol}</h3>
                  <p className="text-xs text-white/40">Current balance: {balances[modalSymbol]?.toFixed(6) || 0}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="modal-amount" className="text-xs font-medium text-white/50 mb-1.5 block pl-1">Amount</Label>
                  <Input
                    id="modal-amount"
                    type="number"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-white/[0.04] border-white/[0.08]"
                  />
                </div>
                <div>
                  <Label htmlFor="modal-note" className="text-xs font-medium text-white/50 mb-1.5 block pl-1">Note (optional)</Label>
                  <Input
                    id="modal-note"
                    type="text"
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    placeholder="e.g. Initial seed, weekly top-up"
                    className="bg-white/[0.04] border-white/[0.08]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button variant="outline" onClick={closeModal}>Cancel</Button>
                <Button
                  onClick={executeAdjustment}
                  disabled={adjusting || !modalAmount || parseFloat(modalAmount) <= 0}
                  className={cn(modalMode === 'topup' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600')}
                >
                  {adjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminRoute>
  );
}
