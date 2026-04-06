'use client';

import { useState, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
import type { KYCStatus } from '@/lib/types';
import Link from 'next/link';

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
  { label: 'All Users', value: 'all' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Not Submitted', value: 'NOT_SUBMITTED' },
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
          <Clock className="h-3 w-3 mr-1" /> KYC Pending
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
          <Shield className="h-3 w-3 mr-1" /> Not Submitted
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
  const { user } = useWallet();

  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState<'all' | KYCStatus>('all');
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalSummary[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // No orderBy to avoid requiring a composite index — sort client-side instead.
  const usersRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users');
  }, [firestore, user]);

  const { data: rawUsers, isLoading, error: usersError } = useCollection<UserDoc>(usersRef);

  // Sort newest-first client-side
  const users = rawUsers
    ? [...rawUsers].sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
        return bTime - aTime;
      })
    : rawUsers;

  const filteredUsers = users?.filter((u) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      u.email?.toLowerCase().includes(searchLower) ||
      u.walletAddress?.toLowerCase().includes(searchLower) ||
      u.id?.toLowerCase().includes(searchLower);
    const matchesKyc =
      kycFilter === 'all' ||
      (kycFilter === 'NOT_SUBMITTED' && !u.kycStatus) ||
      u.kycStatus === kycFilter;
    return matchesSearch && matchesKyc;
  });

  const loadUserDetails = useCallback(async (userDoc: UserDoc) => {
    if (!firestore) return;
    setIsLoadingDetails(true);
    setWalletBalances([]);
    setWithdrawalHistory([]);

    try {
      const walletsSnap = await getDocs(
        collection(firestore, 'users', userDoc.id, 'wallets')
      );
      const balances: WalletBalance[] = walletsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as WalletBalance));
      setWalletBalances(balances.filter((b) => b.balance > 0));

      // No orderBy here — avoids composite index requirement. Sort client-side.
      const withdrawalsSnap = await getDocs(
        query(
          collection(firestore, 'withdrawal_requests'),
          where('userId', '==', userDoc.id)
        )
      );
      const withdrawals: WithdrawalSummary[] = withdrawalsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as WithdrawalSummary))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
          const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
          return bTime - aTime;
        });
      setWithdrawalHistory(withdrawals);
    } catch (e: any) {
      console.error('Error loading user details:', e);
      toast({
        title: 'Failed to Load Details',
        description: e?.message || 'Could not fetch this user\'s portfolio and withdrawal data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [firestore]);

  useEffect(() => {
    if (selectedUser && isDetailOpen) {
      loadUserDetails(selectedUser);
    }
  }, [selectedUser, isDetailOpen, loadUserDetails]);

  const handleOpenDetail = (user: UserDoc) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({ title: 'Copied', description: 'Wallet address copied to clipboard.' });
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast({ title: 'Copied', description: 'Email copied to clipboard.' });
  };

  const kycCounts = {
    all: users?.length || 0,
    APPROVED: users?.filter((u) => u.kycStatus === 'APPROVED').length || 0,
    PENDING: users?.filter((u) => u.kycStatus === 'PENDING').length || 0,
    REJECTED: users?.filter((u) => u.kycStatus === 'REJECTED').length || 0,
    NOT_SUBMITTED: users?.filter((u) => !u.kycStatus || u.kycStatus === 'NOT_SUBMITTED').length || 0,
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tighter uppercase">User Registry</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">
            Full Account Management & Oversight
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 px-3 text-sm font-bold border-border/50">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            {users?.length || 0} Users
          </Badge>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kycCounts.all}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kycCounts.APPROVED}</p>
                <p className="text-xs text-muted-foreground">KYC Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kycCounts.PENDING}</p>
                <p className="text-xs text-muted-foreground">KYC Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kycCounts.NOT_SUBMITTED}</p>
                <p className="text-xs text-muted-foreground">Unverified</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-11 bg-background/50 border-border/60 rounded-xl"
            placeholder="Search by email, wallet address, or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {KYC_FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={kycFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-11 rounded-xl text-xs font-bold',
                kycFilter === opt.value ? '' : 'border-border/50'
              )}
              onClick={() => setKycFilter(opt.value)}
            >
              {opt.label}
              {opt.value !== 'all' && (
                <span className="ml-1.5 opacity-70">
                  ({kycCounts[opt.value as keyof typeof kycCounts] || 0})
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* User List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : usersError ? (
        <Card className="border-destructive/50 bg-card/60">
          <CardContent className="py-20 text-center">
            <h3 className="text-lg font-semibold mb-2 text-destructive">Failed to Load Users</h3>
            <p className="text-sm text-muted-foreground">{usersError.message}</p>
          </CardContent>
        </Card>
      ) : filteredUsers && filteredUsers.length > 0 ? (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <Card
              key={user.id}
              className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors cursor-pointer"
              onClick={() => handleOpenDetail(user)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{user.email}</p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                        {user.walletAddress
                          ? `${user.walletAddress.slice(0, 14)}...${user.walletAddress.slice(-8)}`
                          : 'No wallet address'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {getKycBadge(user.kycStatus)}
                    <p className="text-xs text-muted-foreground hidden md:block">
                      {formatDate(user.createdAt)}
                    </p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border/50 bg-card/60">
          <CardContent className="py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Users Found</h3>
            <p className="text-sm text-muted-foreground">
              {search || kycFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'No registered users yet.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* User Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">User Profile</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Full account overview, balances, and history for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6 mt-2">
              {/* Identity Card */}
              <Card className="border-border/50 bg-muted/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedUser.email}</p>
                        <p className="text-xs text-muted-foreground">UID: {selectedUser.id}</p>
                      </div>
                    </div>
                    {getKycBadge(selectedUser.kycStatus)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/30">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Wallet Address</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-foreground truncate flex-1">
                          {selectedUser.walletAddress
                            ? `${selectedUser.walletAddress.slice(0, 18)}...${selectedUser.walletAddress.slice(-6)}`
                            : 'N/A'}
                        </code>
                        {selectedUser.walletAddress && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleCopyAddress(selectedUser.walletAddress)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Member Since</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm">{formatDate(selectedUser.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2 rounded-xl text-xs border-border/50"
                  onClick={() => handleCopyEmail(selectedUser.email)}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Copy Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2 rounded-xl text-xs border-border/50"
                  asChild
                >
                  <Link
                    href={`/admin/direct-send`}
                    onClick={() => setIsDetailOpen(false)}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Fund Wallet
                  </Link>
                </Button>
                {selectedUser.kycStatus === 'PENDING' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 gap-2 rounded-xl text-xs border-amber-500/30 text-amber-400"
                    asChild
                  >
                    <Link href="/admin/kyc" onClick={() => setIsDetailOpen(false)}>
                      <UserCheck className="h-3.5 w-3.5" />
                      Review KYC
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2 rounded-xl text-xs border-border/50"
                  asChild
                >
                  <Link href="/admin/withdrawals" onClick={() => setIsDetailOpen(false)}>
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    Withdrawals
                  </Link>
                </Button>
              </div>

              {/* Tabs: Wallets / Withdrawals */}
              <Tabs defaultValue="wallets">
                <TabsList className="grid grid-cols-2 bg-muted/30 rounded-xl h-11">
                  <TabsTrigger value="wallets" className="rounded-lg text-xs font-bold gap-2">
                    <Wallet className="h-3.5 w-3.5" /> Portfolio
                  </TabsTrigger>
                  <TabsTrigger value="withdrawals" className="rounded-lg text-xs font-bold gap-2">
                    <ArrowDownRight className="h-3.5 w-3.5" /> Withdrawals
                    {withdrawalHistory.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                        {withdrawalHistory.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="wallets" className="mt-4">
                  {isLoadingDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : walletBalances.length > 0 ? (
                    <div className="space-y-2">
                      {walletBalances.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-[10px] font-black text-primary">{b.currency.slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{b.currency}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">
                                {b.address ? `${b.address.slice(0, 14)}...` : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-bold tabular-nums">{b.balance.toFixed(6)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      {isLoadingDetails ? '' : 'No asset balances found for this user.'}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="withdrawals" className="mt-4">
                  {isLoadingDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : withdrawalHistory.length > 0 ? (
                    <div className="space-y-2">
                      {withdrawalHistory.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30"
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              {formatCurrency(w.fiatAmount, w.fiatCurrency || 'ZAR')}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground">{w.transactionReference}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(w.createdAt)} · {w.withdrawalMethod}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] font-bold uppercase', {
                              'bg-amber-500/10 text-amber-400 border-amber-500/30': w.status === 'PENDING',
                              'bg-green-500/10 text-green-400 border-green-500/30': w.status === 'APPROVED' || w.status === 'COMPLETED',
                              'bg-destructive/10 text-destructive border-destructive/30': w.status === 'REJECTED',
                              'bg-blue-500/10 text-blue-400 border-blue-500/30': w.status === 'PROCESSING',
                            })}
                          >
                            {w.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No withdrawal requests found for this user.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
