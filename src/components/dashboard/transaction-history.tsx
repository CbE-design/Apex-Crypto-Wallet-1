
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
import { Loader2, ExternalLink, Hash } from "lucide-react";
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
        limit(20)
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'default';
      case 'Pending':
        return 'secondary';
      case 'Failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-white/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Private Ledger Transactions</CardTitle>
            <CardDescription>Verified ETH history on the Apex node.</CardDescription>
        </div>
        <div className="hidden md:flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-400">
                <Hash className="h-2 w-2 mr-1" /> NODE_v1.4.2
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 md:px-6">
        <div className="max-h-[500px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card/80 backdrop-blur-sm z-10">
            <TableRow className="border-white/5">
              <TableHead className="text-[10px] uppercase font-bold tracking-widest">Details</TableHead>
              <TableHead className="text-[10px] uppercase font-bold tracking-widest">Asset</TableHead>
              <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest">Amount</TableHead>
              <TableHead className="text-right hidden md:table-cell text-[10px] uppercase font-bold tracking-widest">Value</TableHead>
              <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest">Status</TableHead>
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

                return (
                    <TableRow key={tx.id} className="border-white/5 group hover:bg-white/5">
                    <TableCell>
                        <div className={cn(
                        "font-bold text-sm",
                        tx.type === 'Buy' ? 'text-green-400' : 'text-red-400'
                        )}>
                        {tx.type}
                        </div>
                         <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                            {txHash.substring(0, 10)}...
                            <ExternalLink className="h-2 w-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <CryptoIcon name="Ethereum" className="h-5 w-5"/>
                            <span className="font-bold text-xs">ETH</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                        {tx.type === 'Buy' ? '+' : '-'}{tx.amount.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell font-bold text-xs text-muted-foreground">
                        {formatCurrency(valueInSelectedCurrency)}
                    </TableCell>
                    <TableCell className="text-right">
                        <Badge variant={getStatusVariant(tx.status || 'Completed') as any} className="text-[9px] h-5">
                            {tx.status || 'Completed'}
                        </Badge>
                    </TableCell>
                    </TableRow>
                )
              })
            ) : (
                 <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                            <Hash className="h-10 w-10 text-muted-foreground/20" />
                            <p className="text-muted-foreground text-sm">No ledger entries detected.</p>
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
