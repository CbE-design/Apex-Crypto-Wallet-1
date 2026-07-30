
'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs, collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { CryptoIcon } from '@/components/crypto-icon';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Copy, CheckCheck, ArrowLeft, ExternalLink, Search,
  Cpu, Zap, Globe, Shield, Clock, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownLeft, RotateCcw, Activity, Link2, Link2Off,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// The Apex Private Ledger is a single permissioned EVM network (Anvil).
// Assets are internal balances anchored onto that private chain — this is NOT
// Ethereum/Bitcoin mainnet. Per-asset entries below only drive display styling.
const LEDGER_NAME = 'Apex Private Ledger';
const BLOCKSCOUT_URL = (process.env.NEXT_PUBLIC_BLOCKSCOUT_URL || '').replace(/\/$/, '');

const NETWORK_CONFIG: Record<string, {
  name: string; symbol: string; color: string; unit: string;
}> = {
  ETH:  { name: 'Ether',    symbol: 'ETH',  color: '#627eea', unit: 'ETH'  },
  BTC:  { name: 'Bitcoin',  symbol: 'BTC',  color: '#f7931a', unit: 'BTC'  },
  BNB:  { name: 'BNB',      symbol: 'BNB',  color: '#f3ba2f', unit: 'BNB'  },
  SOL:  { name: 'Solana',   symbol: 'SOL',  color: '#9945ff', unit: 'SOL'  },
  ADA:  { name: 'Cardano',  symbol: 'ADA',  color: '#0033ad', unit: 'ADA'  },
  XRP:  { name: 'XRP',      symbol: 'XRP',  color: '#346aa9', unit: 'XRP'  },
  LINK: { name: 'Chainlink',symbol: 'LINK', color: '#2a5ada', unit: 'LINK' },
  USDT: { name: 'Tether',   symbol: 'USDT', color: '#26a17b', unit: 'USDT' },
  DOGE: { name: 'Dogecoin', symbol: 'DOGE', color: '#c2a633', unit: 'DOGE' },
};

function fmtAge(ts: { toMillis?: () => number } | null | undefined): string {
  if (!ts?.toMillis) return 'N/A';
  const ms = Date.now() - ts.toMillis();
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtDate(ts: { toMillis?: () => number } | null | undefined): string {
  if (!ts?.toMillis) return '—';
  return new Date(ts.toMillis()).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'UTC',
  }) + ' (UTC)';
}

function maskHash(hash: string, keep = 8): string {
  if (!hash || hash.length <= keep * 2) return hash;
  return hash.slice(0, keep) + '…' + hash.slice(-keep);
}

interface ChainStats {
  latestBlock: number | null;
  gasPrice: string | null;
  chainId: string | null;
  reachable: boolean;
}

function ExplorerContent() {
  const { address } = useParams<{ address: string }>();
  const searchParams = useSearchParams();
  const currency = searchParams.get('currency') || 'ETH';
  const net = NETWORK_CONFIG[currency] || NETWORK_CONFIG.ETH;
  const firestore = useFirestore();

  const [wallets, setWallets]           = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [copied, setCopied]             = useState(false);
  const [showAll, setShowAll]           = useState(false);
  const [chain, setChain]               = useState<ChainStats>({
    latestBlock: null, gasPrice: null, chainId: null, reachable: false,
  });

  // Poll real chain stats from Blockscout. Degrades gracefully to "—" when the
  // private ledger / Blockscout instance is not reachable from the browser.
  useEffect(() => {
    if (!BLOCKSCOUT_URL) return;
    let active = true;

    async function loadStats() {
      try {
        const res = await fetch(`${BLOCKSCOUT_URL}/api/v2/stats`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`stats ${res.status}`);
        const data = await res.json();
        if (!active) return;
        setChain({
          latestBlock: data.total_blocks ? Number(data.total_blocks) : null,
          gasPrice: data.gas_prices?.average != null ? String(data.gas_prices.average) : null,
          chainId: data.network_id != null ? String(data.network_id) : null,
          reachable: true,
        });
      } catch {
        if (active) setChain(c => ({ ...c, reachable: false }));
      }
    }

    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!firestore || !address) return;
      setIsLoading(true);
      try {
        const usersQuery = query(collection(firestore, 'users'), where('walletAddress', '==', address));
        let userSnap = await getDocs(usersQuery);

        if (userSnap.empty) {
          const usersQueryLower = query(collection(firestore, 'users'), where('walletAddressLowercase', '==', address.toLowerCase()));
          userSnap = await getDocs(usersQueryLower);
        }

        if (userSnap.empty) {
          const walletsQuery = query(collectionGroup(firestore, 'wallets'), where('address', '==', address));
          const walletSnap = await getDocs(walletsQuery);
          if (walletSnap.empty) { setWallets([]); setTransactions([]); return; }

          const found = walletSnap.docs.map(d => ({ ...d.data(), id: d.id, refPath: d.ref.path }));
          setWallets(found);

          const allTxs: any[] = [];
          for (const w of found) {
            const txSnap = await getDocs(collection(firestore, w.refPath, 'transactions'));
            txSnap.forEach(d => allTxs.push({ ...d.data(), id: d.id }));
          }
          setTransactions(allTxs.sort((a, b) =>
            (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0)
          ));
          return;
        }

        const userId = userSnap.docs[0].id;
        const walletsRef = collection(firestore, 'users', userId, 'wallets');
        const walletSnap = await getDocs(walletsRef);

        const found = walletSnap.docs.map(d => ({ ...d.data(), id: d.id, refPath: d.ref.path, userId }));
        setWallets(found);

        const userTxRef = collection(firestore, 'users', userId, 'transactions');
        const userTxSnap = await getDocs(userTxRef);
        const allTxs: any[] = [];
        userTxSnap.forEach(d => allTxs.push({ ...d.data(), id: d.id }));

        for (const w of found) {
          try {
            const txSnap = await getDocs(collection(firestore, 'users', userId, 'wallets', w.id, 'transactions'));
            txSnap.forEach(d => {
              if (!allTxs.find(t => t.id === d.id)) {
                allTxs.push({ ...d.data(), id: d.id });
              }
            });
          } catch {
            // Subcollection might not exist
          }
        }

        setTransactions(allTxs.sort((a, b) =>
          (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0)
        ));
      } catch {
        setWallets([]); setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [firestore, address]);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wallet  = wallets.find(w => w.currency === currency) || wallets[0];
  const balance = wallet?.balance ?? 0;
  const found   = wallets.length > 0;
  const displayed = showAll ? transactions : transactions.slice(0, 10);
  const anchoredCount = transactions.filter(t => t.onChainTxHash).length;

  const blockDisplay = chain.latestBlock != null ? chain.latestBlock.toLocaleString() : '—';
  const gasDisplay = chain.gasPrice != null ? `${chain.gasPrice} Gwei` : '—';

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-white/[0.06] bg-black/30 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/wallets">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/[0.06]">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: net.color + '20', border: `1px solid ${net.color}40` }}>
                <CryptoIcon name={net.symbol} className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground/80">{LEDGER_NAME}</span>
              <span className={cn('h-1.5 w-1.5 rounded-full', chain.reachable ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/40')} />
              <span className={cn('text-[10px] font-medium', chain.reachable ? 'text-green-400' : 'text-muted-foreground/50')}>
                {chain.reachable ? 'Node connected' : 'Node offline'}
              </span>
            </div>
          </div>
          <div className="flex-1 max-w-sm hidden sm:flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <input
              className="bg-transparent text-xs text-muted-foreground/60 placeholder:text-muted-foreground/30 outline-none w-full"
              placeholder="Search address / tx hash / block..."
              readOnly
            />
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
            <span className="hidden md:flex items-center gap-1"><Cpu className="h-3 w-3" /> Block <span className="font-mono text-white/80">{blockDisplay}</span></span>
            <span className="hidden md:flex items-center gap-1"><Zap className="h-3 w-3" /> {gasDisplay}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Network stat pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { icon: <Globe className="h-3 w-3" />, label: LEDGER_NAME, color: net.color },
            { icon: <Cpu className="h-3 w-3" />,  label: `Block ${blockDisplay}` },
            { icon: <Zap className="h-3 w-3" />,  label: gasDisplay },
            { icon: <Activity className="h-3 w-3" />, label: chain.chainId ? `Chain ${chain.chainId}` : 'Private network' },
          ].map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-full px-3 py-1 text-[10px] text-muted-foreground/70">
              {p.icon} {p.label}
            </div>
          ))}
        </div>

        {/* Disclosure banner */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground/60">
          Balances are recorded on the {LEDGER_NAME}, a private permissioned network. Transactions marked
          <span className="text-green-400/80"> Anchored</span> have a verifiable record on the private chain; entries created
          before ledger anchoring are shown as <span className="text-muted-foreground/80">Not anchored</span>. This network is
          separate from public blockchains such as Ethereum or Bitcoin.
        </div>

        {/* Address card */}
        <div className="glass-module rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
              <Shield className="h-3.5 w-3.5" /> Address
            </div>
            {found && (
              <Badge className="text-[9px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 h-5 gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" /> Private Ledger
              </Badge>
            )}
          </div>
          <div className="px-5 py-4 space-y-5">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-white/[0.08]" style={{ backgroundColor: net.color + '15' }}>
                    <CryptoIcon name={net.symbol} className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono text-white/90 break-all leading-relaxed">{address}</code>
                      <button onClick={handleCopy} className="shrink-0 p-1 rounded hover:bg-white/[0.06] transition-colors">
                        {copied
                          ? <CheckCheck className="h-3.5 w-3.5 text-green-400" />
                          : <Copy className="h-3.5 w-3.5 text-muted-foreground/50" />}
                      </button>
                      {BLOCKSCOUT_URL && (
                        <a
                          href={`${BLOCKSCOUT_URL}/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1 rounded hover:bg-white/[0.06] transition-colors"
                          title="Open in Blockscout"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {LEDGER_NAME} account
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      label: currency + ' Balance',
                      value: balance.toFixed(currency === 'BTC' ? 8 : 6),
                      sub: currency,
                      highlight: true,
                    },
                    {
                      label: 'Transactions',
                      value: transactions.length.toString(),
                      sub: `${anchoredCount} anchored`,
                      highlight: false,
                    },
                    {
                      label: 'Network',
                      value: 'Apex',
                      sub: 'private ledger',
                      highlight: false,
                    },
                    {
                      label: 'Status',
                      value: found ? 'Active' : 'Inactive',
                      sub: found ? 'private ledger' : 'no activity',
                      highlight: false,
                    },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">{s.label}</p>
                      <p className={cn('text-sm font-bold tabular-nums', s.highlight && 'gradient-text')}>{s.value}</p>
                      <p className="text-[10px] text-muted-foreground/50">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Transaction table */}
        <div className="glass-module rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
              <Clock className="h-3.5 w-3.5" /> Transaction History
            </div>
            {transactions.length > 0 && (
              <span className="text-[10px] text-muted-foreground/40">{transactions.length} record{transactions.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground/50">No transactions found for this address</p>
              <p className="text-[10px] text-muted-foreground/30 mt-1">Transfers will appear here once recorded on the private ledger</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_2fr_2fr_1.5fr_1fr] gap-3 px-5 py-2 bg-white/[0.02] border-b border-white/[0.04] text-[9px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
                <span>Tx Hash</span>
                <span>Block</span>
                <span>Age</span>
                <span>From</span>
                <span>To</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Status</span>
              </div>

              {displayed.map((tx) => {
                const isOut = ['Withdrawal','Sell','Send','TRANSFER_SENT'].includes(tx.type);
                const anchored = Boolean(tx.onChainTxHash);
                const hash = tx.onChainTxHash as string | undefined;
                const block = tx.onChainBlockNumber as number | undefined;
                const from = tx.ledgerAddressFrom as string | undefined;
                const to = tx.ledgerAddressTo as string | undefined;
                const txLink = anchored && BLOCKSCOUT_URL ? `${BLOCKSCOUT_URL}/tx/${hash}` : null;

                return (
                  <div
                    key={tx.id}
                    className="px-5 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Mobile layout */}
                    <div className="flex items-start justify-between gap-3 md:hidden">
                      <div className="flex items-start gap-2.5">
                        <div className={cn(
                          'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                          isOut ? 'bg-red-500/10' : 'bg-green-500/10'
                        )}>
                          {isOut
                            ? <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                            : <ArrowDownLeft className="h-3.5 w-3.5 text-green-400" />}
                        </div>
                        <div>
                          {anchored
                            ? <code className="text-[10px] text-primary/80 font-mono">{maskHash(hash!, 6)}</code>
                            : <span className="text-[10px] text-muted-foreground/40 font-mono">Not anchored</span>}
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/50">
                            {block != null && <><span>Block {block.toLocaleString()}</span><span>·</span></>}
                            <span>{fmtAge(tx.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-xs font-bold tabular-nums', isOut ? 'text-red-400' : 'text-green-400')}>
                          {isOut ? '−' : '+'}{(tx.amount ?? 0).toFixed(currency === 'BTC' ? 8 : 6)} {currency}
                        </p>
                        {anchored
                          ? <Badge className="text-[8px] mt-1 bg-green-500/10 text-green-400 border-green-500/20 h-4 px-1.5 gap-1"><Link2 className="h-2.5 w-2.5" /> Anchored</Badge>
                          : <Badge className="text-[8px] mt-1 bg-muted-foreground/10 text-muted-foreground/60 border-muted-foreground/20 h-4 px-1.5 gap-1"><Link2Off className="h-2.5 w-2.5" /> Not anchored</Badge>}
                      </div>
                    </div>

                    {/* Desktop grid */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_2fr_2fr_1.5fr_1fr] gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'h-6 w-6 rounded-md flex items-center justify-center shrink-0',
                          isOut ? 'bg-red-500/10' : 'bg-green-500/10'
                        )}>
                          {isOut
                            ? <ArrowUpRight className="h-3 w-3 text-red-400" />
                            : <ArrowDownLeft className="h-3 w-3 text-green-400" />}
                        </div>
                        {anchored
                          ? (txLink
                              ? <a href={txLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/80 font-mono truncate hover:underline flex items-center gap-1">{maskHash(hash!, 8)}<ExternalLink className="h-2.5 w-2.5" /></a>
                              : <code className="text-[10px] text-primary/80 font-mono truncate">{maskHash(hash!, 8)}</code>)
                          : <span className="text-[10px] text-muted-foreground/40 font-mono truncate">Not anchored</span>}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/70">{block != null ? block.toLocaleString() : '—'}</span>
                      <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{fmtAge(tx.timestamp)}</span>
                      <code className={cn('text-[10px] font-mono truncate', !isOut && 'text-muted-foreground/50')}>
                        {from ? maskHash(from, 6) : '—'}
                      </code>
                      <code className={cn('text-[10px] font-mono truncate', isOut && 'text-muted-foreground/50')}>
                        {to ? maskHash(to, 6) : '—'}
                      </code>
                      <div className="text-right">
                        <p className={cn('text-[11px] font-bold tabular-nums', isOut ? 'text-red-400' : 'text-green-400')}>
                          {isOut ? '−' : '+'}{(tx.amount ?? 0).toFixed(currency === 'BTC' ? 8 : 6)} {currency}
                        </p>
                      </div>
                      <div className="text-right">
                        {anchored
                          ? <Badge className="text-[8px] bg-green-500/10 text-green-400 border-green-500/20 h-4 px-1.5 gap-1"><Link2 className="h-2.5 w-2.5" /> Anchored</Badge>
                          : <Badge className="text-[8px] bg-muted-foreground/10 text-muted-foreground/60 border-muted-foreground/20 h-4 px-1.5 gap-1"><Link2Off className="h-2.5 w-2.5" /> Not anchored</Badge>}
                      </div>
                    </div>

                    {/* Extra metadata row */}
                    <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                      <span className="text-[9px] text-muted-foreground/30">{fmtDate(tx.timestamp)}</span>
                      {tx.onChainId && (
                        <>
                          <span className="text-[9px] text-muted-foreground/30">·</span>
                          <span className="text-[9px] text-muted-foreground/30">Chain {tx.onChainId}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {transactions.length > 10 && (
                <button
                  onClick={() => setShowAll(s => !s)}
                  className="w-full py-3 text-[11px] text-muted-foreground/50 hover:text-white/70 flex items-center justify-center gap-1.5 transition-colors border-t border-white/[0.04] hover:bg-white/[0.02]"
                >
                  {showAll
                    ? <><ChevronDown className="h-3.5 w-3.5 rotate-180" /> Show less</>
                    : <><ChevronRight className="h-3.5 w-3.5" /> View all {transactions.length} transactions</>}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/30 pb-4">
          <span>Apex Block Explorer · {LEDGER_NAME} · Private permissioned node</span>
          <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Auto-refreshing</span>
        </div>
      </div>
    </div>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    }>
      <ExplorerContent />
    </Suspense>
  );
}
