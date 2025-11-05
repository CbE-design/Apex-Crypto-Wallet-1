
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
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase'
import { collection, query, orderBy, limit, type Timestamp, collectionGroup, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from "react";
import { portfolioAssets as staticAssets } from "@/lib/data";
import { useCurrency } from "@/context/currency-context";
import { CryptoIcon } from "../crypto-icon";
import { Loader2 } from "lucide-react";

interface Transaction {
    id: string;
    type: 'Buy' | 'Sell';
    amount: number;
    valueUSD: number;
    timestamp: Timestamp;
    status: 'Completed' | 'Pending' | 'Failed';
    notes?: string;
    currency?: string; // We'll derive this from the path
}

export function TransactionHistory() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { currency, formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !firestore) {
      setIsLoading(false);
      return;
    };

    setIsLoading(true);
    const transactionsQuery = query(
        collectionGroup(firestore, 'transactions'),
        orderBy('timestamp', 'desc'),
        limit(20)
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
        const userTransactions: Transaction[] = [];
        snapshot.forEach((doc) => {
            if (doc.ref.path.startsWith(`users/${user.uid}/`)) {
                const currency = doc.ref.parent.parent?.id; // wallets/{currency}
                userTransactions.push({
                    ...doc.data(),
                    id: doc.id,
                    currency,
                } as Transaction);
            }
        });
        setTransactions(userTransactions);
        setIsLoading(false);
    }, (error) => {
        const contextualError = new FirestorePermissionError({
          path: `users/${user.uid}/wallets/{walletId}/transactions`, // Representing the collection group query
          operation: 'list',
        });
        errorEmitter.emit('permission-error', contextualError);
        setIsLoading(false);
    });

    return () => unsubscribe();

  }, [user, firestore]);

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
        <CardDescription>Your recent transaction activity across all assets.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[450px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card/80 backdrop-blur-sm">
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
                    <TableCell colSpan={6} className="h-48 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
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
                  <TableCell>
                      <div className="flex items-center gap-2">
                        <CryptoIcon name={staticAssets.find(a => a.symbol === tx.currency)?.name || ''} className="h-6 w-6"/>
                        <span>{tx.currency}</span>
                      </div>
                  </TableCell>
                  <TableCell className="text-right">{tx.amount.toFixed(4)}</TableCell>
                  <TableCell className="text-right hidden md:table-cell">{formatCurrency(tx.valueUSD * currency.rate)}</TableCell>
                  <TableCell className="hidden md:table-cell">{tx.timestamp.toDate().toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={getStatusVariant(tx.status) as any}>{tx.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
                 <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                        No transactions found.
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
