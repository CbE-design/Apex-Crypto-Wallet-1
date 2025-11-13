
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
import { Loader2 } from "lucide-react";
import { getLivePrices } from '@/services/crypto-service';

interface Transaction {
    id: string;
    type: 'Buy' | 'Sell';
    amount: number;
    price: number;
    timestamp: Timestamp;
    status: 'Completed' | 'Pending' | 'Failed';
    notes?: string;
    sender?: string;
    recipient?: string;
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
    <Card>
      <CardHeader>
        <CardTitle>Apex Wallet Transactions</CardTitle>
        <CardDescription>Your recent ETH transaction activity.</CardDescription>
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
              transactions.map((tx) => {
                const valueInSelectedCurrency = (tx.amount * (tx.price > 0 ? tx.price : ethPrice)) * currency.rate;
                const isSender = tx.sender?.toLowerCase() === user?.providerData[0]?.uid.toLowerCase();

                return (
                    <TableRow key={tx.id}>
                    <TableCell>
                        <div className={cn(
                        "font-medium",
                        tx.type === 'Buy' ? 'text-green-400' : 'text-red-400'
                        )}>
                        {tx.type}
                        </div>
                         <div className="text-xs text-muted-foreground font-mono break-all">
                            {tx.type === 'Buy' ? `from: ${tx.sender?.substring(0,10)}...` : `to: ${tx.recipient?.substring(0,10)}...`}
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <CryptoIcon name="Ethereum" className="h-6 w-6"/>
                            <span>ETH</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">{tx.amount.toFixed(4)}</TableCell>
                    <TableCell className="text-right hidden md:table-cell">{formatCurrency(valueInSelectedCurrency)}</TableCell>
                    <TableCell className="hidden md:table-cell">{tx.timestamp.toDate().toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                        <Badge variant={getStatusVariant(tx.status || 'Completed') as any}>{tx.status || 'Completed'}</Badge>
                    </TableCell>
                    </TableRow>
                )
              })
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

    