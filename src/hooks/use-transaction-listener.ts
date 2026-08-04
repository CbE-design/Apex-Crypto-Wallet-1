import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, Firestore } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface TransactionEvent {
  id: string;
  type?: string;
  action?: string;
  amount?: number;
  currency?: string;
  status?: string;
  timestamp?: Timestamp | Date | string;
}

export function useTransactionListener(userId: string | undefined, firestore: Firestore | null) {
  const { toast } = useToast();
  const seenRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!userId || !firestore) return;

    const transactionsQuery = query(
      collection(firestore, 'users', userId, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(20),
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      const docs = snapshot.docs;
      if (initialLoadRef.current) {
        docs.forEach((doc) => seenRef.current.add(doc.id));
        initialLoadRef.current = false;
        return;
      }

      docs.forEach((doc) => {
        if (seenRef.current.has(doc.id)) return;
        seenRef.current.add(doc.id);

        const tx = doc.data() as TransactionEvent;
        const type = (tx.type || tx.action || 'transaction').toLowerCase();
        const amount = tx.amount ?? 0;
        const currency = tx.currency ?? '';
        const status = (tx.status || '').toLowerCase();

        if (type === 'receive' || type === 'internal transfer') {
          toast({
            title: 'Deposit Received',
            description: `${amount} ${currency} has arrived in your wallet.`,
          });
        } else if (type === 'buy' || type === 'admin funding') {
          toast({
            title: 'Wallet Credited',
            description: `${amount} ${currency} has been credited to your wallet.`,
          });
        } else if (type === 'withdrawal' && status === 'completed') {
          toast({
            title: 'Withdrawal Completed',
            description: `${amount} ${currency} withdrawal has been processed.`,
          });
        } else if (type === 'send') {
          toast({
            title: 'Transfer Sent',
            description: `You sent ${amount} ${currency}.`,
          });
        } else if (type === 'purchase' || type === 'spend') {
          toast({
            title: 'Purchase Complete',
            description: `You spent ${amount} ${currency}.`,
          });
        }
      });
    }, (error) => {
      console.error('[TransactionListener] Snapshot error:', error);
    });

    return () => unsubscribe();
  }, [userId, firestore, toast]);
}
