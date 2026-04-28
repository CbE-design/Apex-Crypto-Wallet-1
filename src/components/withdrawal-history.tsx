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
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
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
};

function formatDate(timestamp: any): string {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(timestamp: any): string {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

export function WithdrawalHistory() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();
  const [selectedWithdrawal, setSelectedWithdrawal] = React.useState<WithdrawalRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const withdrawalsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'withdrawal_requests'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: withdrawals, isLoading } = useCollection<WithdrawalRequest>(withdrawalsQuery);

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
                <History className="h-4 w-4 text-primary" /> Withdrawal History
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Track all your withdrawal requests and their status
              </CardDescription>
            </div>
            {withdrawals && withdrawals.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {withdrawals.length} request{withdrawals.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto scroll-container">
            <Table>
              <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-md z-10">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold text-muted-foreground pl-4">Date</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground">Method</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : withdrawals && withdrawals.length > 0 ? (
                  withdrawals.map((withdrawal) => {
                    const statusConfig = STATUS_CONFIG[withdrawal.status] || STATUS_CONFIG.PENDING;
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow 
                        key={withdrawal.id} 
                        className="border-border/30 group hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => handleViewDetails(withdrawal)}
                      >
                        <TableCell className="pl-4 py-3">
                          <div className="text-xs font-medium">{formatShortDate(withdrawal.createdAt)}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {withdrawal.transactionReference?.slice(-8) || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-7 w-7 rounded-lg flex items-center justify-center",
                              withdrawal.withdrawalMethod === 'EFT' 
                                ? "bg-primary/10 text-primary" 
                                : "bg-blue-500/10 text-blue-500"
                            )}>
                              {withdrawal.withdrawalMethod === 'EFT' ? (
                                <Building2 className="h-3.5 w-3.5" />
                              ) : (
                                <Globe className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-medium">{withdrawal.withdrawalMethod}</div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                {withdrawal.bankName}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <div className="text-xs font-bold">
                            {new Intl.NumberFormat('en-ZA', {
                              style: 'currency',
                              currency: withdrawal.fiatCurrency || 'ZAR',
                            }).format(withdrawal.fiatAmount)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {withdrawal.cryptoAmount?.toFixed(4)} {withdrawal.cryptoSymbol}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className={cn(
                              "flex items-center gap-1 text-[10px] font-medium",
                              statusConfig.color
                            )}>
                              <StatusIcon className={cn(
                                "h-3 w-3",
                                withdrawal.status === 'PROCESSING' && "animate-spin"
                              )} />
                              <span className="hidden sm:inline">{statusConfig.label}</span>
                            </div>
                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                        <Inbox className="h-8 w-8 opacity-30" />
                        <p className="text-xs">No withdrawal requests yet</p>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Withdrawal Details
            </DialogTitle>
            <DialogDescription>
              Reference: {selectedWithdrawal?.transactionReference || '—'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={cn(
                "p-3 rounded-xl border flex items-center gap-3",
                selectedWithdrawal.status === 'PENDING' && "bg-amber-500/10 border-amber-500/20",
                selectedWithdrawal.status === 'PROCESSING' && "bg-blue-500/10 border-blue-500/20",
                (selectedWithdrawal.status === 'APPROVED' || selectedWithdrawal.status === 'COMPLETED') && "bg-accent/10 border-accent/20",
                (selectedWithdrawal.status === 'REJECTED' || selectedWithdrawal.status === 'FAILED') && "bg-destructive/10 border-destructive/20",
              )}>
                {(() => {
                  const config = STATUS_CONFIG[selectedWithdrawal.status];
                  const Icon = config.icon;
                  return (
                    <>
                      <Icon className={cn("h-5 w-5", config.color, selectedWithdrawal.status === 'PROCESSING' && "animate-spin")} />
                      <div>
                        <p className={cn("text-sm font-semibold", config.color)}>{config.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {selectedWithdrawal.status === 'PENDING' && 'Your request is awaiting admin review'}
                          {selectedWithdrawal.status === 'PROCESSING' && 'Your withdrawal is being processed'}
                          {selectedWithdrawal.status === 'APPROVED' && 'Your withdrawal has been approved'}
                          {selectedWithdrawal.status === 'COMPLETED' && 'Funds have been transferred'}
                          {selectedWithdrawal.status === 'REJECTED' && (selectedWithdrawal.rejectionReason || 'Your request was not approved')}
                          {selectedWithdrawal.status === 'FAILED' && 'An error occurred during processing'}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Amount Details */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-border/30">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <span className="text-sm font-bold">
                    {new Intl.NumberFormat('en-ZA', {
                      style: 'currency',
                      currency: selectedWithdrawal.fiatCurrency || 'ZAR',
                    }).format(selectedWithdrawal.fiatAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30">
                  <span className="text-xs text-muted-foreground">Crypto Sold</span>
                  <span className="text-sm font-medium">
                    {selectedWithdrawal.cryptoAmount?.toFixed(6)} {selectedWithdrawal.cryptoSymbol}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30">
                  <span className="text-xs text-muted-foreground">Network Fee</span>
                  <span className="text-sm font-medium">
                    {new Intl.NumberFormat('en-ZA', {
                      style: 'currency',
                      currency: selectedWithdrawal.fiatCurrency || 'ZAR',
                    }).format(selectedWithdrawal.networkFee || 0)}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Bank Details */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bank Details</p>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">Method</span>
                  <span className="text-xs font-medium">{selectedWithdrawal.withdrawalMethod}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">Bank</span>
                  <span className="text-xs font-medium">{selectedWithdrawal.bankName}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">Account</span>
                  <span className="text-xs font-mono">****{selectedWithdrawal.accountNumber?.slice(-4)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">Beneficiary</span>
                  <span className="text-xs font-medium">{selectedWithdrawal.accountHolder}</span>
                </div>
              </div>

              <Separator />

              {/* Timestamps */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Timeline</p>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">Submitted</span>
                  <span className="text-xs font-medium">{formatDate(selectedWithdrawal.createdAt)}</span>
                </div>
                {selectedWithdrawal.processedAt && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Processed</span>
                    <span className="text-xs font-medium">{formatDate(selectedWithdrawal.processedAt)}</span>
                  </div>
                )}
              </div>

              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => setIsDetailOpen(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
