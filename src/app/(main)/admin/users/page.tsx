'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/context/wallet-context';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  Users,
  Search,
  Clock,
  XCircle,
  CheckCircle2,
  Wallet,
  ArrowDownRight,
  Mail,
  Copy,
  Loader2,
  ShieldCheck,
  Shield,
  ChevronRight,
  User,
  Filter,
  RefreshCw,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import type { KYCStatus } from '@/lib/types';
import Link from 'next/link';
import { AdminRoute } from '@/components/admin/admin-route';

interface UserDoc {
  id: string;
  email: string;
  createdAt: any;
  walletAddress: string;
  kycStatus?: KYCStatus;
  kycSubmissionId?: string;
}

interface WalletBalance {
  id: string;
  currency: string;
  balance: number;
  address: string;
}

interface WithdrawalSummary {
  id: string;
  transactionReference: string;
  fiatAmount: number;
  fiatCurrency: string;
  status: string;
  createdAt: any;
  withdrawalMethod: string;
}

const KYC_FILTER_OPTIONS: { label: string; value: 'all' | KYCStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Verified', value: 'APPROVED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Unverified', value: 'NOT_SUBMITTED' },
];

function getKycBadge(status?: KYCStatus) {
  switch (status) {
    case 'APPROVED':
      return (
        <Badge variant="outline" className="text-[10px] font-bold bg-green-500/10 text-green-400 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border-amber-500/30">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="outline" className="text-[10px] font-bold bg-destructive/10 text-destructive border-destructive/30">
          <XCircle className="h-3 w-3 mr-1" /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] font-bold bg-muted/30 text-muted-foreground border-border/50">
          <Shield className="h-3 w-3 mr-1" /> Unverified
        </Badge>
      );
  }
}

function formatDate(timestamp: any) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function UsersPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: adminUser } = useWallet();

  const [users, setUsers] = useState<UserDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState<'all' | KYCStatus>('all');
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalSummary[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!firestore || !adminUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(firestore, 'users'));
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as UserDoc));
      setUsers(data);
    } catch (err: any) {
      console.error('[Users] Fetch error:', err);
      setError(err.message || 'Failed to pull registry.');
    } finally {
      setIsLoading(false);
    }
  }, [firestore, adminUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const processedUsers = useMemo(() => {
    let filtered = [...users];

    if (kycFilter !== 'all') {
      filtered = filtered.filter(u => 
        kycFilter === 'NOT_SUBMITTED' ? (!u.kycStatus || u.kycStatus === 'NOT_SUBMITTED') : u.kycStatus === kycFilter
      );
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(u => 
        (u.email || '').toLowerCase().includes(s) || 
        (u.walletAddress || '').toLowerCase().includes(s) || 
        (u.id || '').toLowerCase().includes(s)
      );
    }

    return filtered.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds * 1000) ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds * 1000) ?? 0;
      return bTime - aTime;
    });
  }, [users, kycFilter, search]);

  const kycCounts = useMemo(() => {
    const counts = { all: users.length, APPROVED: 0, PENDING: 0, REJECTED: 0, NOT_SUBMITTED: 0 };
    users.forEach(u => {
      const status = u.kycStatus || 'NOT_SUBMITTED';
      if (status === 'APPROVED') counts.APPROVED++;
      else if (status === 'PENDING') counts.PENDING++;
      else if (status === 'REJECTED') counts.REJECTED++;
      else counts.NOT_SUBMITTED++;
    });
    return counts;
  }, [users]);

  const loadUserDetails = useCallback(async (userDoc: UserDoc) => {
    if (!firestore) return;
    setIsLoadingDetails(true);
    try {
      const [walletsSnap, withdrawalsSnap] = await Promise.all([
        getDocs(collection(firestore, 'users', userDoc.id, 'wallets')),
        getDocs(query(collection(firestore, 'withdrawal_requests'), where('userId', '==', userDoc.id)))
      ]);

      const balances = walletsSnap.docs.map(d => ({ id: d.id, ...d.data() } as WalletBalance));
      setWalletBalances(balances.filter(b => b.balance > 0));

      const withdrawals = withdrawalsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as WithdrawalSummary))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds * 1000) ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds * 1000) ?? 0;
          return bTime - aTime;
        });
      setWithdrawalHistory(withdrawals);
    } catch (e: any) {
      console.error('Error loading details:', e);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [firestore]);

  const handleOpenDetail = (user: UserDoc) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
    loadUserDetails(user);
  };

  return (
    <AdminRoute>
      <div className="space-y-6 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">User Registry</h1>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">Live Network Oversight · Identity Management</p>
          </div>
          <button
            className="h-9 px-4 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/40 hover:text-white/70 text-[11px] font-semibold flex items-center gap-2 transition-all disabled:opacity-40"
            onClick={fetchUsers}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Accounts', value: kycCounts.all, icon: Users, border: 'border-violet-500/15 bg-violet-500/5', iconCls: 'bg-violet-500/10 border-violet-500/20 text-violet-400' },
            { label: 'KYC Verified', value: kycCounts.APPROVED, icon: ShieldCheck, border: 'border-emerald-500/15 bg-emerald-500/5', iconCls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
            { label: 'Awaiting Review', value: kycCounts.PENDING, icon: Clock, border: kycCounts.PENDING > 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/[0.06] bg-white/[0.02]', iconCls: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
            { label: 'Anonymous', value: kycCounts.NOT_SUBMITTED, icon: Shield, border: 'border-white/[0.06] bg-white/[0.02]', iconCls: 'bg-white/[0.04] border-white/[0.08] text-white/30' },
          ].map((stat, i) => (
            <div key={i} className={cn("rounded-2xl border p-4", stat.border)}>
              <div className={cn("h-9 w-9 rounded-xl border flex items-center justify-center mb-3", stat.iconCls)}>
                <stat.icon className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
            <Input
              className="pl-10 h-11 bg-white/[0.04] border-white/[0.07] rounded-xl text-sm"
              placeholder="Search by Email, Address or UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scroll-container">
            <div className="flex items-center gap-1.5 px-3 border-r border-white/[0.07] mr-1 text-[9px] font-bold text-white/20 uppercase shrink-0">
              <Filter className="h-3 w-3" /> Filter
            </div>
            {KYC_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={cn(
                  'h-9 px-3 rounded-xl text-[10px] font-semibold uppercase whitespace-nowrap transition-all shrink-0',
                  kycFilter === opt.value
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                    : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/50'
                )}
                onClick={() => setKycFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* User Table */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 overflow-hidden">
          <div className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_auto] gap-4 px-6 py-3 border-b border-white/[0.06] bg-white/[0.03] text-[9px] font-semibold uppercase tracking-[0.18em] text-white/20">
            <span>Identity</span><span>Wallet / UID</span><span>Created</span><span>Compliance</span><span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {error ? (
              <div className="py-20 text-center space-y-4">
                <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
                <p className="text-sm font-bold text-red-300 uppercase tracking-widest">Registry Error</p>
                <p className="text-xs text-white/30">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchUsers} className="border-white/10">Reconnect</Button>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 animate-pulse">Loading Registry...</p>
              </div>
            ) : processedUsers.length > 0 ? (
              processedUsers.map((u) => (
                <div key={u.id}
                  className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_auto] gap-4 px-6 py-4 items-center hover:bg-violet-500/[0.03] transition-colors cursor-pointer group"
                  onClick={() => handleOpenDetail(u)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-white/[0.04] flex items-center justify-center ring-1 ring-white/[0.08] group-hover:ring-violet-500/30 transition-all">
                      <User className="h-4 w-4 text-white/25 group-hover:text-violet-400 transition-colors" />
                    </div>
                    <p className="text-xs font-semibold text-white/70 truncate max-w-[140px]">{u.email}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-mono text-white/30 truncate">{u.walletAddress || 'No Address'}</p>
                    <p className="text-[9px] font-mono text-white/15 uppercase">ID: {u.id.slice(0, 12)}...</p>
                  </div>
                  <div className="text-[10px] font-medium text-white/25">{formatDate(u.createdAt)}</div>
                  <div>{getKycBadge(u.kycStatus)}</div>
                  <div className="text-right">
                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-violet-400 transition-colors" />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center">
                <Users className="h-10 w-10 mx-auto mb-4 text-white/[0.06]" />
                <p className="text-sm font-semibold text-white/20 uppercase tracking-widest">No Matches</p>
                <button className="text-violet-400 text-xs font-semibold mt-2 hover:text-violet-300 transition-colors" onClick={() => { setSearch(''); setKycFilter('all'); }}>Clear Filters</button>
              </div>
            )}
          </div>
        </div>

        {/* Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] p-0 overflow-hidden shadow-2xl shadow-black/60">
            {selectedUser && (
              <div className="flex flex-col h-full max-h-[85vh]">
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px] bg-gradient-to-r from-violet-500 to-cyan-500" />
                <div className="p-7 border-b border-white/[0.06]">
                  <div className="flex flex-row items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <User className="h-7 w-7 text-violet-400" />
                      </div>
                      <div>
                        <DialogTitle className="text-lg font-bold text-white truncate max-w-[280px]">{selectedUser.email}</DialogTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] font-mono text-white/25">UID: {selectedUser.id.slice(0, 16)}...</p>
                          <button onClick={() => { navigator.clipboard.writeText(selectedUser.id); toast({title:'UID Copied'}); }} className="p-0.5 hover:bg-white/5 rounded">
                            <Copy className="h-3 w-3 text-white/20" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {getKycBadge(selectedUser.kycStatus)}
                      <p className="text-[10px] text-white/20">Reg. {formatDate(selectedUser.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-7 space-y-6 overflow-y-auto scroll-container flex-1">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { icon: Mail, label: 'Email', onClick: () => { navigator.clipboard.writeText(selectedUser.email); toast({title:'Email Copied'}); } },
                      { icon: Wallet, label: 'Fund', href: '/admin/direct-send' },
                      { icon: Clock, label: 'KYC', href: '/admin/kyc' },
                      { icon: ArrowDownRight, label: 'Payouts', href: '/admin/withdrawals' },
                    ].map((btn, i) => (
                      btn.href ? (
                        <Link key={i} href={btn.href} onClick={() => setIsDetailOpen(false)}
                          className="h-11 rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:bg-violet-500/10 hover:border-violet-500/20 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 text-white/40 hover:text-violet-400 transition-all">
                          <btn.icon className="h-3.5 w-3.5" />{btn.label}
                        </Link>
                      ) : (
                        <button key={i} onClick={btn.onClick}
                          className="h-11 rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:bg-violet-500/10 hover:border-violet-500/20 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 text-white/40 hover:text-violet-400 transition-all">
                          <btn.icon className="h-3.5 w-3.5" />{btn.label}
                        </button>
                      )
                    ))}
                  </div>

                  <Tabs defaultValue="portfolio" className="w-full">
                    <TabsList className="bg-white/[0.04] border border-white/[0.07] p-1 h-11 rounded-2xl w-full">
                      <TabsTrigger value="portfolio" className="flex-1 rounded-xl text-[10px] font-semibold uppercase gap-2 data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-300 data-[state=active]:border data-[state=active]:border-violet-500/20">
                        <Wallet className="h-3.5 w-3.5" /> Portfolio
                      </TabsTrigger>
                      <TabsTrigger value="activity" className="flex-1 rounded-xl text-[10px] font-semibold uppercase gap-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-500/20">
                        <Activity className="h-3.5 w-3.5" /> Activity
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="portfolio" className="mt-4 space-y-2">
                      {isLoadingDetails ? (
                        <div className="py-12 flex flex-col items-center gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                          <p className="text-[10px] font-semibold text-white/25 uppercase">Scanning Vaults...</p>
                        </div>
                      ) : walletBalances.length > 0 ? walletBalances.map((b) => (
                        <div key={b.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/15 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-white/[0.04] flex items-center justify-center border border-white/[0.07]">
                              <span className="text-[10px] font-bold text-white/50">{b.currency.slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white/80 uppercase">{b.currency}</p>
                              <p className="text-[9px] font-mono text-white/20 truncate max-w-[180px]">{b.address}</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold tabular-nums text-white/70">{b.balance.toLocaleString(undefined, { minimumFractionDigits: 4 })}</p>
                        </div>
                      )) : (
                        <div className="py-12 text-center rounded-2xl border border-white/[0.05]">
                          <p className="text-xs font-semibold text-white/20 uppercase tracking-widest">No Holdings</p>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="activity" className="mt-4">
                      {isLoadingDetails ? (
                        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div>
                      ) : withdrawalHistory.length > 0 ? (
                        <div className="space-y-2">
                          {withdrawalHistory.map((w) => (
                            <div key={w.id} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                              <div className="flex justify-between items-center">
                                <p className="text-sm font-bold text-white/70">{formatCurrency(w.fiatAmount, w.fiatCurrency || 'ZAR')}</p>
                                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-lg",
                                  w.status === 'APPROVED' ? 'text-emerald-400 bg-emerald-500/10' :
                                  w.status === 'PENDING' ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'
                                )}>{w.status}</span>
                              </div>
                              <div className="flex justify-between text-[10px] text-white/20 mt-1">
                                <span>{w.withdrawalMethod}</span>
                                <span>{formatDate(w.createdAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center rounded-2xl border border-white/[0.05]">
                          <p className="text-xs font-semibold text-white/20 uppercase tracking-widest">No Withdrawal History</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="p-5 border-t border-white/[0.05] flex justify-end">
                  <button className="text-[10px] font-semibold uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors" onClick={() => setIsDetailOpen(false)}>Close</button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
}
