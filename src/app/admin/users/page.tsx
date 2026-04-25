'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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
  UserCheck,
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
  Calendar,
  ChevronRight,
  User,
  Filter,
  RefreshCw,
  Activity,
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
  const { isAdmin } = useWallet();

  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState<'all' | KYCStatus>('all');
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalSummary[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // We are an admin, so we can fetch all users
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdmin]);

  const { data: rawUsers, isLoading, error: usersError } = useCollection<UserDoc>(usersQuery);

  const processedUsers = useMemo(() => {
    if (!rawUsers) return [];
    
    let filtered = [...rawUsers];

    if (kycFilter !== 'all') {
      filtered = filtered.filter(u => 
        kycFilter === 'NOT_SUBMITTED' ? (!u.kycStatus || u.kycStatus === 'NOT_SUBMITTED') : u.kycStatus === kycFilter
      );
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(u => 
        u.email?.toLowerCase().includes(s) || 
        u.walletAddress?.toLowerCase().includes(s) || 
        u.id?.toLowerCase().includes(s)
      );
    }

    return filtered.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
      const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
      return bTime - aTime;
    });
  }, [rawUsers, kycFilter, search]);

  const kycCounts = useMemo(() => {
    const counts = { all: rawUsers?.length || 0, APPROVED: 0, PENDING: 0, REJECTED: 0, NOT_SUBMITTED: 0 };
    rawUsers?.forEach(u => {
      const status = u.kycStatus || 'NOT_SUBMITTED';
      if (counts.hasOwnProperty(status)) {
        counts[status as keyof typeof counts]++;
      } else {
        counts.NOT_SUBMITTED++;
      }
    });
    return counts;
  }, [rawUsers]);

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
          const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
          const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
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
            <h1 className="text-3xl font-bold tracking-tight uppercase italic">User Registry</h1>
            <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-primary/80">
              Live Network Oversight & Identity Management
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Data
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Accounts', value: kycCounts.all, icon: Users, color: 'text-primary' },
            { label: 'KYC Verified', value: kycCounts.APPROVED, icon: ShieldCheck, color: 'text-green-500' },
            { label: 'Awaiting Review', value: kycCounts.PENDING, icon: Clock, color: 'text-amber-500' },
            { label: 'Anonymous', value: kycCounts.NOT_SUBMITTED, icon: Shield, color: 'text-muted-foreground' },
          ].map((stat, i) => (
            <Card key={i} className="glass-module border-white/5 overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
               <CardContent className="p-5 relative">
                  <div className="flex items-center justify-between">
                    <div className={cn("p-2 rounded-xl bg-white/5", stat.color)}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="bg-white/5 text-[10px] uppercase font-black">STAT</Badge>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">{stat.label}</p>
                  </div>
               </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="glass-module border-white/5 bg-black/20">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl font-medium focus:ring-primary/20"
                placeholder="Search by Email, Address or UID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scroll-container">
              <div className="flex items-center gap-1.5 px-3 border-r border-white/10 mr-1 text-[10px] font-bold text-muted-foreground uppercase">
                <Filter className="h-3 w-3" /> Filter
              </div>
              {KYC_FILTER_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={kycFilter === opt.value ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
                    kycFilter === opt.value ? 'bg-primary text-black hover:bg-primary/90' : 'bg-white/5 hover:bg-white/10'
                  )}
                  onClick={() => setKycFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Table */}
        <Card className="glass-module border-white/5 bg-black/20 overflow-hidden">
          <div className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_auto] gap-4 px-6 py-3 border-b border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
            <span>Identity</span>
            <span>Wallet / UID</span>
            <span>Created</span>
            <span>Compliance</span>
            <span className="text-right">Actions</span>
          </div>
          
          <div className="divide-y divide-white/5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Synchronizing Registry...</p>
              </div>
            ) : processedUsers.length > 0 ? (
              processedUsers.map((u) => (
                <div 
                  key={u.id} 
                  className="grid grid-cols-[1fr_2fr_1.5fr_1.5fr_auto] gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  onClick={() => handleOpenDetail(u)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center ring-1 ring-white/10 group-hover:ring-primary/30 transition-all">
                      <User className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-xs font-bold truncate max-w-[140px]">{u.email}</p>
                  </div>
                  
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-mono text-muted-foreground/60 truncate">
                      {u.walletAddress || 'No Address Linked'}
                    </p>
                    <p className="text-[9px] font-mono text-muted-foreground/30 uppercase">ID: {u.id.slice(0, 12)}...</p>
                  </div>
                  
                  <div className="text-[10px] font-bold text-muted-foreground/50">
                    {formatDate(u.createdAt)}
                  </div>
                  
                  <div>
                    {getKycBadge(u.kycStatus)}
                  </div>
                  
                  <div className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/10">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center">
                <Users className="h-10 w-10 mx-auto mb-4 text-white/5" />
                <p className="text-sm font-bold text-muted-foreground/40 uppercase tracking-widest">No Matches in Registry</p>
                <Button variant="link" className="text-primary text-xs font-bold mt-2" onClick={() => { setSearch(''); setKycFilter('all'); }}>Clear All Filters</Button>
              </div>
            )}
          </div>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl glass-module border-white/10 bg-black/95 backdrop-blur-3xl rounded-[32px] p-0 overflow-hidden shadow-2xl">
            {selectedUser && (
              <div className="flex flex-col h-full max-h-[85vh]">
                <div className="p-8 border-b border-white/5 bg-gradient-to-br from-white/5 to-transparent">
                  <DialogHeader className="flex flex-row items-start justify-between space-y-0">
                    <div className="flex items-center gap-5">
                      <div className="h-16 w-16 rounded-[22px] bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                        <User className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <DialogTitle className="text-2xl font-bold italic truncate max-w-[300px]">{selectedUser.email}</DialogTitle>
                        <div className="flex items-center gap-2">
                           <p className="text-[10px] font-mono text-muted-foreground/60">UID: {selectedUser.id}</p>
                           <button onClick={() => { navigator.clipboard.writeText(selectedUser.id); toast({title:'UID Copied'}); }} className="p-1 hover:bg-white/5 rounded"><Copy className="h-3 w-3 text-white/20" /></button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       {getKycBadge(selectedUser.kycStatus)}
                       <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">Registered {formatDate(selectedUser.createdAt)}</p>
                    </div>
                  </DialogHeader>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto scroll-container flex-1">
                  {/* Action Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button variant="outline" className="rounded-2xl h-12 bg-white/5 border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest gap-2" onClick={() => { navigator.clipboard.writeText(selectedUser.email); toast({title:'Email Copied'}); }}>
                      <Mail className="h-3.5 w-3.5" /> Email
                    </Button>
                    <Button variant="outline" className="rounded-2xl h-12 bg-white/5 border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest gap-2" asChild>
                      <Link href="/admin/direct-send" onClick={() => setIsDetailOpen(false)}>
                        <Wallet className="h-3.5 w-3.5" /> Fund
                      </Link>
                    </Button>
                    <Button variant="outline" className="rounded-2xl h-12 bg-white/5 border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest gap-2" asChild>
                      <Link href="/admin/kyc" onClick={() => setIsDetailOpen(false)}>
                        <UserCheck className="h-3.5 w-3.5" /> Verify
                      </Link>
                    </Button>
                    <Button variant="outline" className="rounded-2xl h-12 bg-white/5 border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest gap-2" asChild>
                      <Link href="/admin/withdrawals" onClick={() => setIsDetailOpen(false)}>
                        <ArrowDownRight className="h-3.5 w-3.5" /> Payouts
                      </Link>
                    </Button>
                  </div>

                  <Tabs defaultValue="portfolio" className="w-full">
                    <TabsList className="bg-white/5 border border-white/10 p-1 h-12 rounded-2xl w-full">
                      <TabsTrigger value="portfolio" className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 data-[state=active]:bg-primary data-[state=active]:text-black">
                        <Wallet className="h-3.5 w-3.5" /> Portfolio
                      </TabsTrigger>
                      <TabsTrigger value="activity" className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 data-[state=active]:bg-primary data-[state=active]:text-black">
                        <Activity className="h-3.5 w-3.5" /> Activity
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="portfolio" className="mt-6 space-y-3">
                      {isLoadingDetails ? (
                        <div className="py-12 flex flex-col items-center gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Scanning Vaults...</p>
                        </div>
                      ) : walletBalances.length > 0 ? (
                        walletBalances.map((b) => (
                          <div key={b.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                             <div className="flex items-center gap-4">
                               <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                  <span className="text-[10px] font-black">{b.currency.slice(0, 2)}</span>
                               </div>
                               <div>
                                 <p className="text-sm font-bold uppercase">{b.currency}</p>
                                 <p className="text-[9px] font-mono text-muted-foreground/40 truncate max-w-[180px]">{b.address}</p>
                               </div>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-black tabular-nums">{b.balance.toLocaleString(undefined, { minimumFractionDigits: 4 })}</p>
                               <p className="text-[9px] font-bold text-muted-foreground uppercase">Current Balance</p>
                             </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center bg-white/5 rounded-2xl border border-white/5">
                           <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No Asset Holdings Detected</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="activity" className="mt-6">
                      {isLoadingDetails ? (
                        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                      ) : withdrawalHistory.length > 0 ? (
                        <div className="space-y-3">
                          {withdrawalHistory.map((w) => (
                             <div key={w.id} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div className="flex justify-between items-start mb-2">
                                   <p className="text-sm font-black">{formatCurrency(w.fiatAmount, w.fiatCurrency || 'ZAR')}</p>
                                   <Badge variant="outline" className="text-[9px] font-black uppercase bg-primary/10 text-primary border-primary/20">{w.status}</Badge>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground/50">
                                   <span>{w.withdrawalMethod}</span>
                                   <span>{formatDate(w.createdAt)}</span>
                                </div>
                             </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center bg-white/5 rounded-2xl">
                           <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No Withdrawal History</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
                
                <div className="p-6 border-t border-white/5 bg-black/40 flex justify-end">
                   <Button variant="ghost" className="rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-white" onClick={() => setIsDetailOpen(false)}>Close Profile</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
}
