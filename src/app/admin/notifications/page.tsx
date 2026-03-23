'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  writeBatch,
  where,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  Bell,
  CheckCircle2,
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
import type { AdminNotification, AdminNotificationType } from '@/lib/types';
import Link from 'next/link';

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Fetch all notifications
  const notificationsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'admin_notifications'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const unreadRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'admin_notifications'), where('read', '==', false));
  }, [firestore]);

  const { data: notifications, isLoading } = useCollection<AdminNotification>(notificationsRef);
  const { data: unreadNotifications } = useCollection<AdminNotification>(unreadRef);

  const unreadCount = unreadNotifications?.length || 0;

  const handleMarkAsRead = useCallback(async (notification: AdminNotification) => {
    if (!firestore || notification.read) return;
    
    try {
      const notifRef = doc(firestore, 'admin_notifications', notification.id);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [firestore]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!firestore || !unreadNotifications || unreadNotifications.length === 0) return;
    
    setIsMarkingAll(true);
    try {
      const batch = writeBatch(firestore);
      unreadNotifications.forEach((notif) => {
        const notifRef = doc(firestore, 'admin_notifications', notif.id);
        batch.update(notifRef, { read: true });
      });
      await batch.commit();
      
      toast({
        title: 'All Marked as Read',
        description: `${unreadNotifications.length} notifications marked as read.`,
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark notifications as read.',
        variant: 'destructive',
      });
    } finally {
      setIsMarkingAll(false);
    }
  }, [firestore, unreadNotifications, toast]);

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
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getNotificationIcon = (type: AdminNotificationType) => {
    const icons: Record<AdminNotificationType, { icon: typeof Bell; className: string }> = {
      KYC_VERIFICATION: { icon: UserCheck, className: 'text-blue-500 bg-blue-500/10' },
      WITHDRAWAL_REQUEST: { icon: ArrowDownRight, className: 'text-amber-500 bg-amber-500/10' },
      SUPPORT_TICKET: { icon: Info, className: 'text-purple-500 bg-purple-500/10' },
      SYSTEM_ALERT: { icon: AlertTriangle, className: 'text-primary bg-primary/10' },
    };
    return icons[type] || { icon: Bell, className: 'text-muted-foreground bg-muted/30' };
  };

  const getNotificationLink = (notification: AdminNotification) => {
    switch (notification.type) {
      case 'KYC_VERIFICATION':
        return '/admin/kyc';
      case 'WITHDRAWAL_REQUEST':
        return '/admin/withdrawals';
      default:
        return null;
    }
  };

  const NotificationCard = ({ notification }: { notification: AdminNotification }) => {
    const { icon: Icon, className } = getNotificationIcon(notification.type);
    const link = getNotificationLink(notification);

    return (
      <Card 
        className={cn(
          'border-border/50 transition-all cursor-pointer',
          notification.read 
            ? 'bg-card/40 opacity-70' 
            : 'bg-card/80 border-l-2 border-l-primary'
        )}
        onClick={() => handleMarkAsRead(notification)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', className)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn(
                    'text-sm truncate',
                    notification.read ? 'font-medium' : 'font-semibold'
                  )}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                </div>
                {!notification.read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
              
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDate(notification.createdAt)}
                  {notification.userEmail && (
                    <>
                      <span className="text-border">|</span>
                      <span className="truncate max-w-[150px]">{notification.userEmail}</span>
                    </>
                  )}
                </div>
                {link && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href={link}>
                      View <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Notifications</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-[0.3em] text-blue-400">
            Admin Activity Feed & Alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="text-xs"
            >
              {isMarkingAll ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Mark All Read ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{notifications?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount}</p>
                <p className="text-xs text-muted-foreground">Unread</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <ArrowDownRight className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {notifications?.filter(n => n.type === 'WITHDRAWAL_REQUEST').length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Withdrawals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {notifications?.filter(n => n.type === 'KYC_VERIFICATION').length || 0}
                </p>
                <p className="text-xs text-muted-foreground">KYC Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      ) : (
        <Card className="border-border/50 bg-card/60">
          <CardContent className="py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
            <p className="text-sm text-muted-foreground">
              You&apos;ll see alerts here when users submit KYC or withdrawal requests.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
