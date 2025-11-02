
'use client';

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
import { useMemo } from "react";
import { portfolioAssets as staticAssets } from "@/lib/data";
import { useCurrency } from "@/context/currency-context";

interface Transaction {
    id: string;
    type: 'Buy' | 'Sell';
    amount: number;
    valueUSD: number;
    timestamp: Timestamp;
    status: 'Completed' | 'Pending' | 'Failed';
}

export function TransactionHistory() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { currency, formatCurrency } = useCurrency();

  // We need to listen to all wallet transaction subcollections.
  // This is a more complex query that we'll simplify for now.
  // For this version, we will just show transactions for ETH.
  const transactionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'users', user.uid, 'wallets', 'ETH', 'transactions'), 
        orderBy('timestamp', 'desc'), 
        limit(10)
    );
  }, [user, firestore]);

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

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
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Your recent transaction activity for ETH.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right hidden md:table-cell">Value</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        Loading transactions...
                    </TableCell>
                </TableRow>
            ) : transactions && transactions.length > 0 ? (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div className={cn(
                      "font-medium",
                      tx.type === 'Buy' ? 'text-green-400' : 'text-red-400'
                    )}>
                      {tx.type}
                    </div>
                  </TableCell>
                  <TableCell>ETH</TableCell>
                  <TableCell className="text-right font-mono">{tx.amount.toFixed(4)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell font-mono">{formatCurrency(tx.valueUSD * currency.rate)}</TableCell>
                  <TableCell className="hidden md:table-cell">{tx.timestamp.toDate().toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={getStatusVariant(tx.status) as any}>{tx.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
                 <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        No transactions found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
