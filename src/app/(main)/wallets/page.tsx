'use client';

import * as React from 'react';
import { ethers } from 'ethers';
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
import {
  USDT_ABI,
  USDT_ADDRESS,
  USDT_CHAIN_ID,
  USDT_CHAIN_NAME,
  USDT_EXPLORER_URL,
  USDT_RPC_URL,
} from '@/config/usdt';
import { APXD_ABI, APXD_ADDRESS, APXD_CHAIN_ID, APXD_CHAIN_NAME, APXD_DECIMALS, APXD_EXPLORER_URL, APXD_RPC_URL, isApxdConfigured } from '@/config/apxd';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface WalletDoc {
  id: string; // Asset symbol e.g. BTC
  balance: number;
  currency: string;
}

interface TransactionDoc extends Transaction {
  id: string;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export default function MyWalletsPage() {
  const { user, wallet } = useWallet();
  const firestore = useFirestore();
  const { formatCurrency, currency: nativeCurrency } = useCurrency();
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [watchAssetMessage, setWatchAssetMessage] = React.useState<string | null>(null);
  const [metamaskAccount, setMetamaskAccount] = React.useState<string | null>(null);
  const [isMetamaskConnecting, setIsMetamaskConnecting] = React.useState(false);
  const [liveUsdtBalance, setLiveUsdtBalance] = React.useState<number | null>(null);
  const [liveUsdtError, setLiveUsdtError] = React.useState<string | null>(null);
  const [isLiveUsdtLoading, setIsLiveUsdtLoading] = React.useState(false);
  const [liveApxdBalance, setLiveApxdBalance] = React.useState<number | null>(null);
  const [liveApxdError, setLiveApxdError] = React.useState<string | null>(null);

  const refreshLiveApxdBalance = React.useCallback(async (account: string) => {
    if (!window.ethereum || !isApxdConfigured() || !ethers.isAddress(account)) return;
    setLiveApxdError(null);
    try {
      const provider = new ethers.JsonRpcProvider(APXD_RPC_URL, { name: APXD_CHAIN_NAME, chainId: Number(APXD_CHAIN_ID) });
      const network = await provider.getNetwork();
      if (network.chainId !== APXD_CHAIN_ID) throw new Error('APXD network mismatch');
      const contract = new ethers.Contract(APXD_ADDRESS, APXD_ABI, provider);
      const rawBalance = await contract.balanceOf(account);
      setLiveApxdBalance(Number(ethers.formatUnits(rawBalance, APXD_DECIMALS)));
    } catch (error) {
      console.error('[v0] Failed to read live APXD balance:', error);
      setLiveApxdBalance(null);
      setLiveApxdError('Live APXD balance is temporarily unavailable.');
    }
  }, []);

  const refreshLiveUsdtBalance = React.useCallback(async (account: string) => {
    if (!window.ethereum || !ethers.isAddress(account)) return;
    setIsLiveUsdtLoading(true);
    setLiveUsdtError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const network = await provider.getNetwork();
      if (network.chainId !== USDT_CHAIN_ID) {
        setLiveUsdtBalance(null);
        setLiveUsdtError(`Switch MetaMask to ${USDT_CHAIN_NAME} to read live USDT.`);
        return;
      }
      const contract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
      const rawBalance = await contract.balanceOf(account);
      setLiveUsdtBalance(Number(ethers.formatUnits(rawBalance, 6)));
    } catch (error) {
      console.error('[v0] Failed to read live USDT balance:', error);
      setLiveUsdtBalance(null);
      setLiveUsdtError('Live USDT balance is temporarily unavailable.');
    } finally {
      setIsLiveUsdtLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!metamaskAccount || !window.ethereum) return;
    void refreshLiveUsdtBalance(metamaskAccount);
    void refreshLiveApxdBalance(metamaskAccount);
    const handleAccountsChanged = (accounts: unknown) => {
      const account = Array.isArray(accounts) ? String(accounts[0] ?? '') : '';
      setMetamaskAccount(account || null);
      if (account) { void refreshLiveUsdtBalance(account); void refreshLiveApxdBalance(account); }
      else { setLiveUsdtBalance(null); setLiveApxdBalance(null); }
    };
    const handleChainChanged = () => {
      setLiveApxdBalance(null);
      void refreshLiveUsdtBalance(metamaskAccount);
      void refreshLiveApxdBalance(metamaskAccount);
    };
    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);
    const interval = window.setInterval(() => {
      setLiveApxdBalance(null);
      void refreshLiveUsdtBalance(metamaskAccount);
      void refreshLiveApxdBalance(metamaskAccount);
    }, 15000);
    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
      window.clearInterval(interval);
    };
  }, [metamaskAccount, refreshLiveUsdtBalance, refreshLiveApxdBalance]);

  const connectMetamask = async () => {
    setWatchAssetMessage(null);
    if (!window.ethereum) {
      setWatchAssetMessage('Install MetaMask or open this page in its browser extension.');
      return null;
    }

    setIsMetamaskConnecting(true);
    try {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${USDT_CHAIN_ID.toString(16)}` }],
        });
      } catch (switchError) {
        if ((switchError as { code?: number }).code !== 4902) throw switchError;
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${USDT_CHAIN_ID.toString(16)}`,
            chainName: USDT_CHAIN_NAME,
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [USDT_RPC_URL],
            blockExplorerUrls: [USDT_EXPLORER_URL],
          }],
        });
      }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const account = accounts?.[0] ?? null;
      setMetamaskAccount(account);
      if (account) void refreshLiveUsdtBalance(account);
      if (!account) setWatchAssetMessage('MetaMask did not return an account.');
      return account;
    } catch (error) {
      console.error('[v0] Failed to connect MetaMask:', error);
      setWatchAssetMessage('MetaMask connection was canceled or unavailable.');
      return null;
    } finally {
      setIsMetamaskConnecting(false);
    }
  };

  const addApxdToMetamask = async () => {
    setWatchAssetMessage(null);
    if (!isApxdConfigured()) { setWatchAssetMessage('APXD is not configured yet.'); return; }
    const account = metamaskAccount || await connectMetamask();
    if (!account || !wallet || account.toLowerCase() !== wallet.address.toLowerCase()) {
      setWatchAssetMessage('Connect the exact Apex APXD wallet address before adding APXD.');
      return;
    }
    try {
      await window.ethereum?.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: APXD_ADDRESS, symbol: 'APXD', decimals: APXD_DECIMALS } } });
      await refreshLiveApxdBalance(account);
      setWatchAssetMessage('APXD was added to MetaMask.');
    } catch (error) {
      console.error('[v0] Failed to add APXD to MetaMask:', error);
      setWatchAssetMessage('MetaMask canceled the APXD request.');
    }
  };

  const addTokenToMetamask = async () => {
    setWatchAssetMessage(null);
    if (!metamaskAccount && !(await connectMetamask())) return;
    if (!window.ethereum) {
      setWatchAssetMessage('MetaMask is not installed in this browser.');
      return;
    }

    try {
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: USDT_ADDRESS,
            symbol: 'USDT',
            decimals: 6,
            image: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=040',
          },
        },
      });
      setWatchAssetMessage(wasAdded ? 'USDT was added to MetaMask.' : 'MetaMask did not add USDT.');
    } catch (error) {
      console.error('[v0] Failed to add USDT to MetaMask:', error);
      setWatchAssetMessage('MetaMask canceled the request or could not add USDT.');
    }
  };

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
      const isUsdt = walletDoc.currency.toUpperCase() === 'USDT';
      const isApxd = walletDoc.currency.toUpperCase() === 'APXD';
      const amount = isUsdt && liveUsdtBalance !== null ? liveUsdtBalance : isApxd && liveApxdBalance !== null ? liveApxdBalance : walletDoc.balance;
      return {
        symbol: walletDoc.currency,
        name: walletDoc.currency,
        amount,
        valueUSD: amount * priceUSD,
        priceUSD,
        change24h,
        icon: '',
      };
    });
  }, [walletData, prices, changes, liveUsdtBalance, liveApxdBalance]);

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
              <div className="flex items-center gap-2">
                <p className="font-bold text-white text-base">{asset.name}</p>
                {asset.symbol.toUpperCase() === 'APXD' && (
                  <Button type="button" variant="outline" size="sm" onClick={addApxdToMetamask} disabled={isMetamaskConnecting} aria-label="Connect exact APXD wallet and add APXD to MetaMask" className="h-6 rounded-md border-cyan-500/25 bg-cyan-500/5 px-2 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200">
                    {isMetamaskConnecting ? 'Connecting…' : 'Connect APXD'}
                  </Button>
                )}
                {asset.symbol.toUpperCase() === 'USDT' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTokenToMetamask}
                    disabled={isMetamaskConnecting}
                    aria-label={metamaskAccount ? 'Add USDT to MetaMask' : 'Connect MetaMask and add USDT'}
                    className="h-6 rounded-md border-emerald-500/25 bg-emerald-500/5 px-2 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                  >
                    {isMetamaskConnecting ? 'Connecting…' : metamaskAccount ? 'MetaMask' : 'Connect MetaMask'}
                  </Button>
                )}
              </div>
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
        {asset.symbol.toUpperCase() === 'APXD' && (watchAssetMessage || liveApxdError || liveApxdBalance !== null) && (
          <p role="status" className="mt-3 text-xs text-white/50">
            {watchAssetMessage || liveApxdError || `Live APXD balance on ${APXD_CHAIN_NAME}: ${liveApxdBalance?.toFixed(6)}`}
          </p>
        )}
        {asset.symbol.toUpperCase() === 'USDT' && (watchAssetMessage || liveUsdtError || isLiveUsdtLoading || metamaskAccount) && (
          <p role="status" className="mt-3 text-xs text-white/50">
            {watchAssetMessage || liveUsdtError || (isLiveUsdtLoading ? `Reading live ${USDT_CHAIN_NAME} USDT balance…` : metamaskAccount ? `Live balance from ${USDT_CHAIN_NAME}` : null)}
          </p>
        )}

        <div className="mt-5 pt-5 border-t border-white/[0.05]">
           <p className="text-sm text-white/80 font-mono">{asset.amount.toFixed(6)} {asset.symbol}</p>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {actionButtons.map(({ label, icon: Icon, disabled, accent }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                className={cn(
                  'flex-1 flex flex-col items-center justify-center h-16 rounded-xl bg-white/[0.03] border-white/[0.06] hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-500/30 transition-colors',
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

  // State for transaction details modal
  const [selectedTx, setSelectedTx] = React.useState<TransactionDoc | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const openDetails = (tx: TransactionDoc) => {
    setSelectedTx(tx);
    setIsDetailOpen(true);
  };

  const closeDetails = () => {
    setIsDetailOpen(false);
    setSelectedTx(null);
  };

  const TransactionRow = ({ tx }: { tx: TransactionDoc }) => {
    // Determine debit vs credit using a more robust heuristic
    const typeLower = (tx.type || '').toLowerCase();
    const isDebit =
      typeLower === 'sell' ||
      typeLower === 'withdrawal' ||
      typeLower === 'transfer_sent' ||
      typeLower.includes('sent') ||
      typeLower.includes('withdraw');

    // Safe amount parsing
    const rawAmount = Number(tx.amount || 0);
    const safeAmount = isNaN(rawAmount) ? 0 : rawAmount;

    // Price lookup from live prices or transaction payload
    const price = Number((prices as any)[tx.currency] ?? (tx as any).pricePerCoinUSD ?? 0);
    const safePrice = isNaN(price) || price <= 0 ? 0 : price;
    const value = safeAmount * safePrice;

    // Safe date handling
    let dateObj = new Date();
    if (tx.timestamp && typeof (tx as any).timestamp.toDate === 'function') {
      dateObj = (tx as any).timestamp.toDate();
    } else if (tx.timestamp) {
      dateObj = new Date(tx.timestamp as any);
    } else if ((tx as any).createdAt) {
      dateObj = new Date((tx as any).createdAt);
    }

    return (
      <div className="grid grid-cols-4 gap-4 items-center px-4 py-3 text-xs border-b border-white/[0.05] last:border-b-0 hover:bg-violet-500/[0.03] transition-colors">
        <div className="flex items-center gap-3">
          <CryptoIcon name={tx.currency} className="w-7 h-7" />
          <div>
            <p className="font-semibold text-white/80">{tx.currency}</p>
            <p className="text-[10px] text-white/30">{dateObj.toLocaleDateString()}</p>
          </div>
        </div>

        <p className={cn(
          "font-semibold",
          isDebit ? 'text-red-400' : 'text-emerald-400'
        )}>
          {isDebit ? '-' : '+'} {safeAmount.toFixed(6)}
        </p>

        <p className="font-mono text-white/40">{formatCurrency(value)}</p>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 text-white/40 hover:text-white" onClick={() => openDetails(tx)}>
            Details
          </Button>
        </div>
      </div>
    );
  };

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
      
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.04] p-1">
          <span className="sr-only">Change portfolio view</span>
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

       {/* Transaction Details Dialog */}
       <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Transaction Details</DialogTitle>
             <DialogDescription>
               {selectedTx ? `Details for ${selectedTx.currency} transaction` : ''}
             </DialogDescription>
           </DialogHeader>

           {selectedTx ? (
             <div className="space-y-4 mt-2">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-[10px] text-white/30 uppercase tracking-wider">Type</p>
                   <p className="font-medium text-white/80">{selectedTx.type || 'Transfer'}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-white/30 uppercase tracking-wider">Date</p>
                   <p className="font-medium text-white/80">{new Date((selectedTx.timestamp?.seconds ?? 0) * 1000).toLocaleString()}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-white/30 uppercase tracking-wider">Amount</p>
                   <p className="font-medium text-emerald-400">{Number(selectedTx.amount || 0).toFixed(6)} {selectedTx.currency}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-white/30 uppercase tracking-wider">Value</p>
                   <p className="font-medium text-white/80">{formatCurrency((Number(selectedTx.amount || 0)) * (Number((prices as any)[selectedTx.currency] ?? (selectedTx as any).pricePerCoinUSD ?? 0)))}</p>
                 </div>
               </div>

               {selectedTx.from && (
                 <div>
                   <p className="text-[10px] text-white/30 uppercase tracking-wider">From</p>
                   <p className="font-mono text-sm text-white/60">{selectedTx.from}</p>
                 </div>
               )}

               {selectedTx.to && (
                 <div>
                   <p className="text-[10px] text-white/30 uppercase tracking-wider">To</p>
                   <p className="font-mono text-sm text-white/60">{selectedTx.to}</p>
                 </div>
               )}

               {selectedTx.txHash && (
                 <div>
                   <p className="text-[10px] text-white/30 uppercase tracking-wider">Transaction</p>
                   <p className="font-mono text-sm text-white/60 break-all">{selectedTx.txHash}</p>
                    {selectedTx.metadata?.explorerUrl && (
                      <a
                        href={selectedTx.metadata.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex mt-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                      >
                        Verify publicly on explorer
                      </a>
                    )}
                 </div>
               )}

               <div className="flex justify-end">
                 <Button variant="outline" onClick={closeDetails}>Close</Button>
               </div>
             </div>
           ) : null}
         </DialogContent>
       </Dialog>
     </div>
   );
}
