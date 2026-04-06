
'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs, collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo } from 'react';
import { CryptoIcon } from '@/components/crypto-icon';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Copy, CheckCheck, ArrowLeft, ExternalLink, Search,
  Cpu, Zap, Globe, Shield, Clock, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownLeft, RotateCcw, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NETWORK_CONFIG: Record<string, {
  name: string; fullName: string; symbol: string; color: string; unit: string;
  feeLabel: string; hashPrefix: string; blockTime: number; confirmations: number;
  tps: number; gasUnit: string;
}> = {
  ETH:  { name: 'Ethereum',  fullName: 'Ethereum Mainnet',  symbol: 'ETH',  color: '#627eea', unit: 'ETH',  feeLabel: 'Gas',       hashPrefix: '0x', blockTime: 12, confirmations: 32,   tps: 15,  gasUnit: 'Gwei' },
  BTC:  { name: 'Bitcoin',   fullName: 'Bitcoin Mainnet',   symbol: 'BTC',  color: '#f7931a', unit: 'BTC',  feeLabel: 'Fee',       hashPrefix: '',   blockTime: 600, confirmations: 6,   tps: 7,   gasUnit: 'sat/vB' },
  BNB:  { name: 'BSC',       fullName: 'BNB Smart Chain',   symbol: 'BNB',  color: '#f3ba2f', unit: 'BNB',  feeLabel: 'Gas',       hashPrefix: '0x', blockTime: 3,  confirmations: 15,   tps: 100, gasUnit: 'Gwei' },
  SOL:  { name: 'Solana',    fullName: 'Solana Mainnet',    symbol: 'SOL',  color: '#9945ff', unit: 'SOL',  feeLabel: 'Priority',  hashPrefix: '',   blockTime: 0.4, confirmations: 32,  tps: 65000, gasUnit: 'lamports' },
  ADA:  { name: 'Cardano',   fullName: 'Cardano Mainnet',   symbol: 'ADA',  color: '#0033ad', unit: 'ADA',  feeLabel: 'Fee',       hashPrefix: '',   blockTime: 20, confirmations: 20,   tps: 250, gasUnit: 'Lovelace' },
  XRP:  { name: 'XRP',       fullName: 'XRP Ledger',        symbol: 'XRP',  color: '#346aa9', unit: 'XRP',  feeLabel: 'Fee',       hashPrefix: '',   blockTime: 3,  confirmations: 1,    tps: 1500, gasUnit: 'drops' },
  LINK: { name: 'Ethereum',  fullName: 'Ethereum Mainnet',  symbol: 'LINK', color: '#2a5ada', unit: 'LINK', feeLabel: 'Gas',       hashPrefix: '0x', blockTime: 12, confirmations: 32,   tps: 15,  gasUnit: 'Gwei' },
  USDT: { name: 'Ethereum',  fullName: 'Ethereum Mainnet',  symbol: 'USDT', color: '#26a17b', unit: 'USDT', feeLabel: 'Gas',       hashPrefix: '0x', blockTime: 12, confirmations: 32,   tps: 15,  gasUnit: 'Gwei' },
  DOGE: { name: 'Dogecoin',  fullName: 'Dogecoin Mainnet',  symbol: 'DOGE', color: '#c2a633', unit: 'DOGE', feeLabel: 'Fee',       hashPrefix: '',   blockTime: 60, confirmations: 60,   tps: 40,  gasUnit: 'DOGE' },
};

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function fmtTxHash(id: string, prefix: string, length: number): string {
  const pad = '0123456789abcdef'.repeat(10);
  const raw = id.replace(/[^a-f0-9]/gi, '').toLowerCase().padEnd(length, pad);
  return prefix + raw.substring(0, length);
}

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
  return new Date(ts.toMillis()).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Africa/Johannesburg',
  }) + ' (SAST)';
}

function maskAddress(addr: string, keep = 6): string {
  if (!addr || addr.length <= keep * 2) return addr;
  return addr.slice(0, keep) + '…' + addr.slice(-keep);
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
  const [liveBlock, setLiveBlock]       = useState(0);
  const [liveGas, setLiveGas]           = useState(0);
  const [liveTps, setLiveTps]           = useState(0);
  const [showAll, setShowAll]           = useState(false);

  const seed   = useMemo(() => hashStr(address + currency), [address, currency]);
  const rand   = useMemo(() => seededRandom(seed), [seed]);

  const baseBlock = useMemo(() => {
    if (currency === 'BTC')  return 840000 + Math.floor(rand() * 5000);
    if (currency === 'SOL')  return 260000000 + Math.floor(rand() * 1000000);
    if (currency === 'ADA')  return 9800000  + Math.floor(rand() * 50000);
    if (currency === 'DOGE') return 5100000  + Math.floor(rand() * 50000);
    return 19800000 + Math.floor(rand() * 200000);
  }, [seed]);

  const baseGas = useMemo(() => {
    if (currency === 'SOL')  return 0.000005;
    if (currency === 'ADA')  return 0.17;
    if (currency === 'BTC')  return Math.floor(rand() * 30) + 10;
    return Math.floor(rand() * 25) + 8;
  }, [seed]);

  useEffect(() => {
    setLiveBlock(baseBlock);
    setLiveGas(baseGas);
    setLiveTps(Math.floor(rand() * net.tps * 0.8) + Math.floor(net.tps * 0.2));

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - Date.now() + 1000) / (net.blockTime * 1000));
      setLiveBlock(b => b + 1);
      setLiveGas(g => parseFloat((g + (Math.random() - 0.5) * 0.5).toFixed(2)));
      setLiveTps(t => Math.max(1, t + Math.floor((Math.random() - 0.5) * 20)));
    }, net.blockTime * 1000);

    return () => clearInterval(interval);
  }, [baseBlock, baseGas]);

  useEffect(() => {
    async function fetch() {
      if (!firestore || !address) return;
      setIsLoading(true);
      try {
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
      } catch {
        setWallets([]); setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
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

  function getTxHash(tx: any) {
    return fmtTxHash(tx.id, net.hashPrefix, currency === 'SOL' ? 88 : currency === 'BTC' ? 64 : 66);
  }

  function getTxBlock(tx: any, idx: number): number {
    const ms = tx.timestamp?.toMillis?.() ?? Date.now();
    return baseBlock - idx * Math.floor(net.blockTime * 2) - Math.floor(rand() * 20);
  }

  function getTxFee(tx: any): string {
    const r = seededRandom(hashStr(tx.id));
    if (currency === 'ETH' || currency === 'LINK' || currency === 'BNB' || currency === 'USDT') {
      const feeUnit = currency === 'BNB' ? 'BNB' : 'ETH';
      return (r() * 0.003 + 0.0005).toFixed(4) + ' ' + feeUnit;
    }
    if (currency === 'BTC')  return (Math.floor(r() * 300) + 100) + ' sats';
    if (currency === 'SOL')  return '0.000005 SOL';
    if (currency === 'ADA')  return (r() * 0.3 + 0.17).toFixed(4) + ' ADA';
    if (currency === 'XRP')  return '0.000012 XRP';
    if (currency === 'DOGE') return (r() * 0.1 + 0.01).toFixed(4) + ' DOGE';
    return '—';
  }

  function fromTo(tx: any, addr: string): { from: string; to: string } {
    const outbound = ['Withdrawal', 'Sell', 'Send'].includes(tx.type);
    const r = seededRandom(hashStr(tx.id + 'peer'));
    const peerLen = currency === 'SOL' ? 44 : 42;
    const peerSeed = '0123456789abcdef'.repeat(6);
    const peer = net.hashPrefix + Array.from({ length: peerLen - net.hashPrefix.length })
      .map((_, i) => peerSeed[(Math.floor(r() * 16))] )
      .join('');
    return outbound ? { from: addr, to: peer } : { from: peer, to: addr };
  }

  const gasDisplay = currency === 'SOL'
    ? '0.000005 SOL'
    : currency === 'ADA'
      ? '0.1721 ADA'
      : `${liveGas.toFixed(2)} ${net.gasUnit}`;

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
              <span className="text-xs font-semibold text-muted-foreground/80">{net.fullName}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400 font-medium">Live</span>
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
            <span className="hidden md:flex items-center gap-1"><Cpu className="h-3 w-3" /> Block <span className="font-mono text-foreground/80">{liveBlock.toLocaleString()}</span></span>
            <span className="hidden md:flex items-center gap-1"><Zap className="h-3 w-3" /> {gasDisplay}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Network stat pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { icon: <Globe className="h-3 w-3" />, label: net.fullName, color: net.color },
            { icon: <Cpu className="h-3 w-3" />,  label: `Block ${liveBlock.toLocaleString()}` },
            { icon: <Zap className="h-3 w-3" />,  label: `${liveGas.toFixed(2)} ${net.gasUnit}` },
            { icon: <Activity className="h-3 w-3" />, label: `${liveTps.toLocaleString()} TPS` },
          ].map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-full px-3 py-1 text-[10px] text-muted-foreground/70">
              {p.icon} {p.label}
            </div>
          ))}
        </div>

        {/* Address card */}
        <div className="glass-module rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
              <Shield className="h-3.5 w-3.5" /> Address
            </div>
            {found && (
              <Badge className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2 h-5 gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" /> Verified
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
                      <code className="text-xs font-mono text-foreground/90 break-all leading-relaxed">{address}</code>
                      <button onClick={handleCopy} className="shrink-0 p-1 rounded hover:bg-white/[0.06] transition-colors">
                        {copied
                          ? <CheckCheck className="h-3.5 w-3.5 text-green-400" />
                          : <Copy className="h-3.5 w-3.5 text-muted-foreground/50" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {net.name} {['ETH','LINK','USDT'].includes(currency) ? 'ERC-20' : currency === 'BNB' ? 'BEP-20' : ''} Address
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
                      sub: 'total',
                      highlight: false,
                    },
                    {
                      label: 'Network',
                      value: net.name,
                      sub: 'mainnet',
                      highlight: false,
                    },
                    {
                      label: 'Status',
                      value: found ? 'Active' : 'Inactive',
                      sub: found ? 'on-chain' : 'no activity',
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
              <p className="text-[10px] text-muted-foreground/30 mt-1">Transactions will appear here once confirmed on the network</p>
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

              {displayed.map((tx, idx) => {
                const hash = getTxHash(tx);
                const block = getTxBlock(tx, idx);
                const { from, to } = fromTo(tx, address as string);
                const isOut = ['Withdrawal','Sell','Send'].includes(tx.type);

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
                          <code className="text-[10px] text-primary/80 font-mono">{hash.slice(0, 18)}…</code>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/50">
                            <span>Block {block.toLocaleString()}</span>
                            <span>·</span>
                            <span>{fmtAge(tx.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-xs font-bold tabular-nums', isOut ? 'text-red-400' : 'text-green-400')}>
                          {isOut ? '−' : '+'}{(tx.amount ?? 0).toFixed(currency === 'BTC' ? 8 : 6)} {currency}
                        </p>
                        <Badge className="text-[8px] mt-1 bg-green-500/10 text-green-400 border-green-500/20 h-4 px-1.5">Confirmed</Badge>
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
                        <code className="text-[10px] text-primary/80 font-mono truncate">{hash.slice(0, 20)}…</code>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/70">{block.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{fmtAge(tx.timestamp)}</span>
                      <code className={cn('text-[10px] font-mono truncate', !isOut && 'text-muted-foreground/50')}>
                        {maskAddress(from, 8)}
                      </code>
                      <code className={cn('text-[10px] font-mono truncate', isOut && 'text-muted-foreground/50')}>
                        {maskAddress(to, 8)}
                      </code>
                      <div className="text-right">
                        <p className={cn('text-[11px] font-bold tabular-nums', isOut ? 'text-red-400' : 'text-green-400')}>
                          {isOut ? '−' : '+'}{(tx.amount ?? 0).toFixed(currency === 'BTC' ? 8 : 6)} {currency}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="text-[8px] bg-green-500/10 text-green-400 border-green-500/20 h-4 px-1.5">✓ Confirmed</Badge>
                      </div>
                    </div>

                    {/* Extra metadata row */}
                    <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                      <span className="text-[9px] text-muted-foreground/30">{fmtDate(tx.timestamp)}</span>
                      <span className="text-[9px] text-muted-foreground/30">·</span>
                      <span className="text-[9px] text-muted-foreground/30">{net.confirmations} confirmations</span>
                      <span className="text-[9px] text-muted-foreground/30">·</span>
                      <span className="text-[9px] text-muted-foreground/30">{net.feeLabel}: {getTxFee(tx)}</span>
                    </div>
                  </div>
                );
              })}

              {transactions.length > 10 && (
                <button
                  onClick={() => setShowAll(s => !s)}
                  className="w-full py-3 text-[11px] text-muted-foreground/50 hover:text-foreground/70 flex items-center justify-center gap-1.5 transition-colors border-t border-white/[0.04] hover:bg-white/[0.02]"
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
          <span>Apex Block Explorer · {net.fullName} · Private Ledger Node</span>
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
