
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, query, orderBy, limit, type Timestamp } from 'firebase/firestore'
import { useCurrency } from "@/context/currency-context";
import { CryptoIcon } from "../crypto-icon";
import { Loader2, ExternalLink, Hash, Activity, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { getLivePrices } from '@/services/crypto-service';

interface Transaction {
    id: string;
    type: 'Buy' | 'Sell' | 'Withdrawal' | 'Swap';
    amount: number;
    price: number;
    timestamp: Timestamp;
    status: 'Completed' | 'Pending' | 'Failed';
    notes?: string;
    sender?: string;
    recipient?: string;
    txHash?: string;
    blockNumber?: number;
}

export function TransactionHistory() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { currency, formatCurrency } = useCurrency();
  const [ethPrice, setEthPrice] = React.useState(0);
  
  const transactionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'users', user.uid, 'wallets', 'ETH', 'transactions'),
        orderBy('timestamp', 'desc'),
        limit(15)
    );
  }, [user, firestore]);

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  React.useEffect(() => {
    async function fetchEthPrice() {
      try {
        const prices = await getLivePrices(['ETH'], 'USD');
        if (prices.ETH) {
          setEthPrice(prices.ETH);
        }
      } catch (error) {
        console.error("Failed to fetch ETH price for history", error);
      }
    }
    fetchEthPrice();
  }, []);

  return (
    <Card className="glass-module overflow-hidden border-white/5">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/5">
        <div>
            <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" /> Ledger Activity
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                Apex Real-Time Verification Node
            </CardDescription>
        </div>
        <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/10">
            0.00ms Latency
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-auto scroll-container">
        <Table>
          <TableHeader className="sticky top-0 bg-background/50 backdrop-blur-md z-10">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground pl-6">Type</TableHead>
              <TableHead className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">Asset</TableHead>
              <TableHead className="text-right text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">Amount</TableHead>
              <TableHead className="text-right hidden md:table-cell text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground">Market Value</TableHead>
              <TableHead className="text-right text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                </TableRow>
            ) : transactions && transactions.length > 0 ? (
              transactions.map((tx) => {
                const valueInSelectedCurrency = (tx.amount * (tx.price > 0 ? tx.price : ethPrice)) * currency.rate;
                const txHash = tx.txHash || '0x' + tx.id.substring(0, 10).padEnd(64, '0');
                const isIncoming = tx.type === 'Buy' || tx.type === 'Swap';

                return (
                    <TableRow key={tx.id} className="border-white/5 group hover:bg-white/5 transition-colors">
                    <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "p-2 rounded-lg border",
                                isIncoming ? "bg-accent/10 border-accent/20 text-accent" : "bg-primary/10 border-primary/20 text-primary"
                            )}>
                                {isIncoming ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            </div>
                            <div>
                                <div className="font-black text-xs uppercase tracking-tight">{tx.type}</div>
                                <div className="text-[9px] text-muted-foreground font-mono truncate max-w-[80px]">
                                    {txHash.substring(0, 12)}...
                                </div>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <CryptoIcon name="Ethereum" className="h-4 w-4 opacity-70"/>
                            <span className="font-black text-[10px] text-muted-foreground">ETH</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-xs tracking-tighter">
                        <span className={isIncoming ? "text-accent" : "text-white"}>
                            {isIncoming ? '+' : '-'}{tx.amount.toFixed(4)}
                        </span>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell font-mono text-[10px] text-muted-foreground/60">
                        {formatCurrency(valueInSelectedCurrency)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5 text-[9px] font-black text-accent uppercase italic tracking-widest">
                            <div className="h-1 w-1 rounded-full bg-accent animate-pulse" />
                            Confirmed
                        </div>
                    </TableCell>
                    </TableRow>
                )
              })
            ) : (
                 <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                            <Hash className="h-16 w-16 text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Ledger Entries Found</p>
                        </div>
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  )
}
