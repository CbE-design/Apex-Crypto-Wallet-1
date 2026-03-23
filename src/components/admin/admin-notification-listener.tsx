'use client';

import { useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { BellRing, ArrowDownRight, UserCheck } from 'lucide-react';
import type { AdminNotification } from '@/lib/types';

/**
 * High-integrity listener that monitors the admin activity feed in real-time.
 * Dispatches system toasts to active administrators for immediate orchestration.
 */
export function AdminNotificationListener() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const lastProcessedId = useRef<string | null>(null);

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // We only care about the most recent unread notification
    return query(
      collection(firestore, 'admin_notifications'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
  }, [firestore]);

  const { data: notifications } = useCollection<AdminNotification>(notificationsQuery);

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const latest = notifications[0];
      
      // Prevent duplicate toasts for the same notification during re-renders
      if (latest.id !== lastProcessedId.current) {
        lastProcessedId.current = latest.id;

        const isWithdrawal = latest.type === 'WITHDRAWAL_REQUEST';
        
        toast({
          title: 'System Action Required',
          description: latest.message,
          variant: 'default',
          className: 'bg-card border-primary/20 border-l-4 border-l-primary',
        });
      }
    }
  }, [notifications, toast]);

  return null;
}
