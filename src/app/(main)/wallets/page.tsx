'use client';

import * as React from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useLivePrices } from '@/hooks/use-live-prices';
import { useCurrency } from '@/context/currency-context';
import { portfolioAssets as staticAssets, marketCoins } from '@/lib/data';
import { CryptoIcon } from '@/components/crypto-icon';
import { Skeleton } from '@/components/ui/skeleton';
import type { PortfolioAsset } from '@/lib/types';

interface WalletDoc {
  balance: number;
  currency: string;
}

export default function MyWalletsPage() {
  const { user } = useWallet();
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();

  // Dynamically bind to the per-user asset ledger:
  // users/{uid}/wallets/{assetSymbol}
  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);

  const { data: walletData, isLoading: isWalletLoading } = useCollection<WalletDoc>(walletsQuery);

  const symbols = React.useMemo(() => {
    if (!walletData) return [];
    return walletData.map(w => w.currency);
  }, [walletData]);

  const { prices, changes, isLoading: isPriceLoading, error: priceError } = useLivePrices(symbols);

  const isLoading = isWalletLoading || (isPriceLoading && symbols.length > 0);

  const assets: PortfolioAsset[] = React.useMemo(() => {
    if (!walletData) return [];
    return walletData.map(walletDoc => {
      const livePriceUSD = prices[walletDoc.currency];
      const staticAssetData = staticAssets.find(sa => sa.symbol === walletDoc.currency);
      const marketData = marketCoins.find(m => m.symbol === walletDoc.currency);
      const priceUSD = livePriceUSD !== undefined
        ? livePriceUSD
        : (staticAssetData?.priceUSD ?? marketData?.priceUSD ?? 0);
      const change24h = changes[walletDoc.currency] ?? staticAssetData?.change24h ?? marketData?.change24h ?? 0;
      return {
        symbol: walletDoc.currency,
        name: staticAssetData?.name ?? marketData?.name ?? walletDoc.currency,
        amount: walletDoc.balance,
        valueUSD: walletDoc.balance * priceUSD,
        priceUSD,
        change24h,
        icon: staticAssetData?.icon ?? marketData?.icon ?? '',
      };
    });
  }, [walletData, prices, changes]);

  const sortedAssets = React.useMemo(
    () => [...assets].sort((a, b) => b.valueUSD - a.valueUSD),
    [assets],
  );

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Wallet className="h-5 w-5 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">My Wallets</h1>
        </div>
        <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-white/25 ml-1">
          On-Chain Asset Management
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-900/50 p-4 rounded-lg border border-gray-800/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center bg-white/[0.02] rounded-xl p-10 border border-gray-800/50">
          <h4 className="text-base font-semibold text-white mb-1">No assets yet</h4>
          <p className="text-sm text-gray-400">Your wallet balances will appear here once you add funds.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAssets.map((asset) => (
            <div
              key={asset.symbol}
              className="bg-gray-900/50 hover:bg-gray-900/80 transition-colors p-4 rounded-lg border border-gray-800/50 flex justify-between items-center"
            >
              <div className="flex items-center gap-4">
                <CryptoIcon name={asset.name} className="w-8 h-8" />
                <div>
                  <p className="font-bold text-white">{asset.name}</p>
                  <p className="text-sm text-gray-400 font-mono">
                    {asset.amount.toFixed(asset.symbol === 'BTC' ? 6 : 4)} {asset.symbol}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('font-semibold text-white', priceError && 'text-muted-foreground/70')}>
                  {formatCurrency(asset.valueUSD)}
                </p>
                <div className={cn(
                  'text-xs font-bold flex items-center justify-end gap-1',
                  priceError ? 'text-muted-foreground/50' : asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {asset.change24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span>{Math.abs(asset.change24h).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
