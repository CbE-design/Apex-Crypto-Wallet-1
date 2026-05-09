'use client';

import { useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { AdminNotification } from '@/lib/types';

export function AdminNotificationListener() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const lastProcessedId = useRef<string | null>(null);

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // No orderBy — avoids requiring a composite index on admin_notifications.
    // We sort client-side after fetching.
    return query(
      collection(firestore, 'admin_notifications'),
      where('read', '==', false),
    );
  }, [firestore]);

  const { data: notifications } = useCollection<AdminNotification>(notificationsQuery);

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;
    // Sort newest first in JS — no composite index required
    const sorted = [...notifications].sort((a, b) => {
      const aTime = (a as any).createdAt?.toMillis?.() ?? 0;
      const bTime = (b as any).createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    const latest = sorted[0];
    if (latest.id === lastProcessedId.current) return;
    lastProcessedId.current = latest.id;

    const isWithdrawal = latest.type === 'WITHDRAWAL_REQUEST';
    const isKyc = latest.type === 'KYC_VERIFICATION';
    const isNewUser = latest.type === 'NEW_USER';
    const isUrgent = !!(latest.metadata?.urgent);

    const actionPath = isWithdrawal
      ? '/admin/withdrawals'
      : isKyc
      ? '/admin/kyc'
      : isNewUser
      ? '/admin/users'
      : null;

    const toastTitle = isUrgent
      ? '🚨 Action Required — KYC Blocking Withdrawal'
      : isWithdrawal
      ? '💸 New Withdrawal Request'
      : isKyc
      ? '🪪 New KYC Submission'
      : isNewUser
      ? '👤 New User Registered'
      : '⚡ System Alert';

    toast({
      title: toastTitle,
      description: latest.message,
      duration: 8000,
      className: [
        'border-l-4 pr-2',
        isUrgent
          ? 'border-l-red-500 bg-red-500/5'
          : isWithdrawal
          ? 'border-l-amber-500 bg-amber-500/5'
          : isKyc
          ? 'border-l-blue-500 bg-blue-500/5'
          : isNewUser
          ? 'border-l-green-500 bg-green-500/5'
          : 'border-l-primary bg-card',
      ].join(' '),
      action: actionPath ? (
        <button
          onClick={() => router.push(actionPath)}
          className="shrink-0 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
        >
          Review →
        </button>
      ) : undefined,
    });
  }, [notifications, toast, router]);

  return null;
}
