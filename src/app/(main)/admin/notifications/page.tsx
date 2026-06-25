'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWallet } from '@/context/wallet-context';
import {
  collection,
  query,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  Bell,
  Clock,
  Loader2,
  UserCheck,
  ArrowDownRight,
  AlertTriangle,
  Info,
  Check,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { AdminNotification, AdminNotificationType } from '@/lib/types';
import Link from 'next/link';

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useWallet();
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all notifications — no orderBy to avoid composite index requirement;
  // sorted client-side by createdAt descending.
  const notificationsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'admin_notifications');
  }, [firestore, user]);

  const unreadRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'admin_notifications'), where('read', '==', false));
  }, [firestore, user]);

  const { data: rawNotifications, isLoading, error: notificationsError } = useCollection<AdminNotification>(notificationsRef);
  const { data: unreadNotifications } = useCollection<AdminNotification>(unreadRef);

  // Sort newest-first client-side
  const notifications = rawNotifications
    ? [...rawNotifications].sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
        const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
        return bTime - aTime;
      })
    : rawNotifications;

  const unreadCount = unreadNotifications?.length || 0;

  const handleMarkAsRead = useCallback(
    async (notification: AdminNotification) => {
      if (!firestore || notification.read) return;
      try {
        await updateDoc(doc(firestore, 'admin_notifications', notification.id), { read: true });
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    },
    [firestore]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!firestore || !unreadNotifications || unreadNotifications.length === 0) return;
    setIsMarkingAll(true);
    try {
      // Firestore batch limit is 500 — chunk if necessary
      const chunks: AdminNotification[][] = [];
      for (let i = 0; i < unreadNotifications.length; i += 499) {
        chunks.push(unreadNotifications.slice(i, i + 499));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(firestore);
        chunk.forEach((notif) => {
          batch.update(doc(firestore, 'admin_notifications', notif.id), { read: true });
        });
        await batch.commit();
      }
      toast({
        title: 'All Marked as Read',
        description: `${unreadNotifications.length} notification${unreadNotifications.length === 1 ? '' : 's'} marked as read.`,
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({ title: 'Error', description: 'Failed to mark notifications as read.', variant: 'destructive' });
    } finally {
      setIsMarkingAll(false);
    }
  }, [firestore, unreadNotifications, toast]);

  const handleDelete = useCallback(
    async (notificationId: string) => {
      if (!firestore) return;
      setDeletingId(notificationId);
      try {
        await deleteDoc(doc(firestore, 'admin_notifications', notificationId));
        toast({ title: 'Notification Dismissed', description: 'Notification removed from feed.' });
      } catch (error) {
        console.error('Error deleting notification:', error);
        toast({ title: 'Error', description: 'Could not delete notification.', variant: 'destructive' });
      } finally {
        setDeletingId(null);
      }
    },
    [firestore, toast]
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getNotificationIcon = (type: AdminNotificationType) => {
    const icons: Record<AdminNotificationType, { icon: typeof Bell; className: string }> = {
      KYC_VERIFICATION: { icon: UserCheck, className: 'text-blue-500 bg-blue-500/10' },
      WITHDRAWAL_REQUEST: { icon: ArrowDownRight, className: 'text-amber-500 bg-amber-500/10' },
      SUPPORT_TICKET: { icon: Info, className: 'text-purple-500 bg-purple-500/10' },
      SYSTEM_ALERT: { icon: AlertTriangle, className: 'text-primary bg-primary/10' },
      NEW_USER: { icon: Check, className: 'text-green-500 bg-green-500/10' },
    };
    return icons[type] ?? { icon: Bell, className: 'text-muted-foreground bg-muted/30' };
  };

  const getNotificationLink = (notification: AdminNotification) => {
    switch (notification.type) {
      case 'KYC_VERIFICATION': return '/admin/kyc';
      case 'WITHDRAWAL_REQUEST': return '/admin/withdrawals';
      case 'NEW_USER': return '/admin/users';
      default: return null;
    }
  };

  const NotificationCard = ({ notification }: { notification: AdminNotification }) => {
    const { icon: Icon, className } = getNotificationIcon(notification.type);
    const link = getNotificationLink(notification);
    const isDeleting = deletingId === notification.id;

    return (
      <div
        className={cn(
          'rounded-2xl border p-4 transition-all',
          notification.read
            ? 'border-white/[0.05] bg-white/[0.01] opacity-60'
            : 'border-violet-500/15 bg-[#0A0C12]/80 cursor-pointer hover:border-violet-500/25 hover:bg-violet-500/[0.03]'
        )}
        onClick={() => !notification.read && handleMarkAsRead(notification)}
      >
          <div className="flex items-start gap-3">
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', className)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn('text-sm truncate', notification.read ? 'text-white/40 font-medium' : 'text-white/80 font-semibold')}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-violet-400 mt-1.5" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.04]">
                <div className="flex items-center gap-2 text-[10px] text-white/25">
                  <Clock className="h-3 w-3" />
                  {formatDate(notification.createdAt)}
                  {notification.userEmail && (
                    <>
                      <span className="text-white/10">|</span>
                      <span className="truncate max-w-[150px]">{notification.userEmail}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {link && (
                    <Link href={link} onClick={(e) => e.stopPropagation()}
                      className="h-7 px-2 rounded-lg text-[10px] font-semibold text-violet-400/60 hover:text-violet-400 hover:bg-violet-500/10 flex items-center gap-1 transition-all">
                        View <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="h-7 w-7 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all disabled:opacity-40"
                        disabled={isDeleting}
                        onClick={(e) => e.stopPropagation()}
                        title="Dismiss notification"
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/60">
                      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px] bg-gradient-to-r from-red-500 to-violet-500" />
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white font-bold">Dismiss Notification</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/30">
                          This will permanently remove <strong className="text-white/50">"{notification.title}"</strong> from the feed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl border-white/10 bg-white/[0.04] text-white/40">Keep</AlertDialogCancel>
                        <AlertDialogAction className="rounded-xl bg-red-500/80 hover:bg-red-500" onClick={() => handleDelete(notification.id)}>Dismiss</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Bell className="h-5 w-5 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Notifications</h1>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 ml-1">Admin Activity Feed · Alerts</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="h-9 px-4 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/40 hover:text-white/70 text-[11px] font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              {isMarkingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Mark All Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Bell className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{notifications?.length || 0}</p>
              <p className="text-[10px] font-semibold text-white/25 uppercase">Total</p>
            </div>
          </div>
        </div>

        <div className={cn("rounded-2xl border p-4", unreadCount > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-white/[0.06] bg-white/[0.02]")}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{unreadCount}</p>
              <p className="text-[10px] font-semibold text-white/25 uppercase">Unread</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {notifications?.filter((n) => n.type === 'WITHDRAWAL_REQUEST').length || 0}
              </p>
              <p className="text-[10px] font-semibold text-white/25 uppercase">Withdrawals</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {notifications?.filter((n) => n.type === 'KYC_VERIFICATION').length || 0}
              </p>
              <p className="text-[10px] font-semibold text-white/25 uppercase">KYC</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      ) : notificationsError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 py-20 text-center">
          <h3 className="text-lg font-semibold mb-2 text-red-300">Failed to Load</h3>
          <p className="text-sm text-white/30">{notificationsError.message}</p>
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-20 text-center">
          <Bell className="h-10 w-10 mx-auto mb-4 text-white/[0.08]" />
          <h3 className="text-sm font-semibold text-white/20 uppercase tracking-widest">No Notifications</h3>
          <p className="text-xs text-white/15 mt-1">Alerts will appear when users submit KYC or withdrawal requests.</p>
        </div>
      )}
    </div>
  );
}
