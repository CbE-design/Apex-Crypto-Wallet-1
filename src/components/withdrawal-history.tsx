'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatAppDate, formatAppTimeShort } from "@/lib/utils";
import { useUser, useFirestore } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCurrency } from "@/context/currency-context";
import { 
  Loader2, 
  History, 
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Globe,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import type { WithdrawalRequest, WithdrawalStatus } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const STATUS_CONFIG: Record<WithdrawalStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending Review', color: 'text-amber-500', icon: Clock },
  PROCESSING: { label: 'Processing', color: 'text-blue-500', icon: Loader2 },
  APPROVED: { label: 'Approved', color: 'text-accent', icon: CheckCircle2 },
  COMPLETED: { label: 'Completed', color: 'text-accent', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'text-destructive', icon: XCircle },
  FAILED: { label: 'Failed', color: 'text-destructive', icon: AlertTriangle },
  CANCELLED: { label: 'Cancelled', color: 'text-muted-foreground', icon: XCircle },
};

export function WithdrawalHistory() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();
  const [withdrawals, setWithdrawals] = React.useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = React.useState<WithdrawalRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const fetchWithdrawals = React.useCallback(async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      // Use getDocs to avoid stream issues
      const snap = await getDocs(query(
        collection(firestore, 'withdrawal_requests'),
        where('userId', '==', user.uid)
      ));
      
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as WithdrawalRequest));
      
      // Sort client-side
      const sorted = data.sort((a, b) => {
        const t1 = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000 ?? 0;
        const t2 = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000 ?? 0;
        return t2 - t1;
      });
      
      setWithdrawals(sorted);
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
    } finally {
      setLoading(false);
    }
  }, [user, firestore]);

  React.useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleViewDetails = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setIsDetailOpen(true);
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm overflow-hidden border-border/60">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Payout Stream
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Active and historical withdrawal requests
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchWithdrawals} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto scroll-container">
            <Table>
              <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-md z-10">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold text-muted-foreground pl-4">Date</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : withdrawals.length > 0 ? (
                  withdrawals.map((withdrawal) => {
                    const statusConfig = STATUS_CONFIG[withdrawal.status] || STATUS_CONFIG.PENDING;
                    
                    return (
                      <TableRow 
                        key={withdrawal.id} 
                        className="border-border/30 group hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => handleViewDetails(withdrawal)}
                      >
                        <TableCell className="pl-4 py-3">
                          <div className="text-[10px] font-bold">
                            {formatAppDate(withdrawal.createdAt)}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono">
                            {withdrawal.transactionReference?.slice(-8) || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-[11px] font-black">
                             {new Intl.NumberFormat('en-ZA', {
                              style: 'currency',
                              currency: withdrawal.fiatCurrency || 'ZAR',
                            }).format(withdrawal.fiatAmount)}
                          </div>
                          <div className="text-[9px] text-muted-foreground uppercase font-bold">
                            {withdrawal.withdrawalMethod}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-4 py-3">
                          <div className={cn("text-[9px] font-black uppercase flex items-center justify-end gap-1", statusConfig.color)}>
                             {withdrawal.status}
                             <ChevronRight className="h-3 w-3 opacity-30" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                        <Inbox className="h-8 w-8 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No Requests Detected</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md rounded-[32px] glass-module border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Withdrawal Status
            </DialogTitle>
            <DialogDescription>
              Reference: {selectedWithdrawal?.transactionReference || '—'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-2xl border flex items-center gap-3",
                selectedWithdrawal.status === 'PENDING' && "bg-amber-500/10 border-amber-500/20",
                selectedWithdrawal.status === 'APPROVED' && "bg-accent/10 border-accent/20",
                selectedWithdrawal.status === 'REJECTED' && "bg-destructive/10 border-destructive/20",
              )}>
                {(() => {
                  const config = STATUS_CONFIG[selectedWithdrawal.status];
                  const Icon = config.icon;
                  return (
                    <>
                      <Icon className={cn("h-6 w-6", config.color)} />
                      <div>
                        <p className={cn("text-xs font-black uppercase", config.color)}>{config.label}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {selectedWithdrawal.status === 'PENDING' && 'Awaiting internal compliance review'}
                          {selectedWithdrawal.status === 'REJECTED' && (selectedWithdrawal.rejectionReason || 'Declined')}
                          {selectedWithdrawal.status === 'APPROVED' && 'Funds released for payout'}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-muted-foreground">Payout Amount</span>
                  <span>{new Intl.NumberFormat('en-ZA', { style: 'currency', currency: selectedWithdrawal.fiatCurrency || 'ZAR' }).format(selectedWithdrawal.fiatAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground/50">
                  <span>Settlement Method</span>
                  <span>{selectedWithdrawal.withdrawalMethod}</span>
                </div>
              </div>

              <Button variant="outline" className="w-full rounded-xl h-12 text-[10px] font-black uppercase" onClick={() => setIsDetailOpen(false)}>Close Overview</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
