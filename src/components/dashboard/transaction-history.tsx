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
import { transactions } from "@/lib/data"
import { cn } from "@/lib/utils"

export function TransactionHistory() {
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
        <CardDescription>Your recent transaction activity.</CardDescription>
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
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  <div className={cn(
                    "font-medium",
                    tx.type === 'Buy' ? 'text-green-500' : 'text-red-500'
                  )}>
                    {tx.type}
                  </div>
                </TableCell>
                <TableCell>{tx.asset}</TableCell>
                <TableCell className="text-right">{tx.amount.toFixed(4)}</TableCell>
                <TableCell className="text-right hidden md:table-cell">${tx.valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="hidden md:table-cell">{new Date(tx.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={getStatusVariant(tx.status) as any}>{tx.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
