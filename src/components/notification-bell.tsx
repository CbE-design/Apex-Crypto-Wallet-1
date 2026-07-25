'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Bell, X, Info, TrendingUp, Shield, AlertCircle, Megaphone,
  Check, Trash2, Clock, ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotificationBell, MergedNotification, type NotificationCategory } from '@/hooks/use-notification-bell';
import { useWallet } from '@/context/wallet-context';

const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  general: { label: 'General', icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  market: { label: 'Market', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  security: { label: 'Security', icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  system: { label: 'System', icon: AlertCircle, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  promotion: { label: 'Promotion', icon: Megaphone, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-slate-400',
  normal: 'bg-blue-400',
  high: 'bg-amber-400',
  urgent: 'bg-red-500',
};

function formatNotificationTime(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: MergedNotification;
  onMarkAsRead: (n: MergedNotification) => void;
  onDelete: (n: MergedNotification) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = CATEGORY_CONFIG[notification.category] || CATEGORY_CONFIG.general;
  const Icon = config.icon;
  const body = notification.body || notification.message || '';
  const isLong = body.length > 120;

  return (
    <div className={`group relative p-3 border-b border-white/[0.06] last:border-b-0 ${!notification.read ? 'bg-white/[0.02]' : ''}`}>
      {/* unread indicator */}
      {!notification.read && (
        <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-primary" />
      )}

      <div className="flex gap-3 pl-2">
        <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${config.bg}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white leading-tight truncate">{notification.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${config.bg} ${config.color} border-current`}>
                  {config.label}
                </Badge>
                <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[notification.priority] || PRIORITY_DOT.normal}`} />
                <span className="text-[10px] text-white/40 capitalize">{notification.priority}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-white/[0.08] text-white/40 hover:text-primary"
                  onClick={() => onMarkAsRead(notification)}
                  title="Mark as read"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-white/[0.08] text-white/40 hover:text-red-400"
                onClick={() => onDelete(notification)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-white/60 mt-2 leading-relaxed">
            {expanded || !isLong ? body : `${body.slice(0, 120)}...`}
          </p>
          {isLong && (
            <button
              className="text-[10px] text-primary hover:underline mt-1 flex items-center gap-0.5"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> Show more</>
              )}
            </button>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-[10px] text-white/40">
              <Clock className="h-3 w-3" />
              <span>{formatNotificationTime(notification.createdAt)}</span>
              <span className="text-white/20">•</span>
              <span className="truncate max-w-[120px]">{notification.sender || 'Apex'}</span>
            </div>
            {notification.isBroadcast && notification.sentCount !== undefined && (
              <span className="text-[10px] text-white/30">
                {notification.sentCount} sent
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { user } = useWallet();
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotificationBell(user?.uid);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => markAsRead(n)));
  };

  if (!user) {
    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-white/30 cursor-not-allowed"
          disabled
        >
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition-colors relative"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[380px] max-w-[calc(100vw-1rem)] bg-[#0B0D14]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
          <div className="p-4 border-b border-white/[0.08]">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-white">Notifications</h3>
                <p className="text-xs text-white/40">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'No new notifications'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-white hover:bg-white/[0.08]"
                    onClick={handleMarkAllAsRead}
                  >
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/[0.08]" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4 text-white/50" />
                </Button>
              </div>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-white/[0.05] flex items-center justify-center mb-3">
                  <Bell className="h-5 w-5 text-white/30" />
                </div>
                <p className="text-sm text-white/50">No notifications yet.</p>
                <p className="text-xs text-white/30 mt-1">
                  New announcements and alerts will appear here.
                </p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-2 border-t border-white/[0.08]">
              <Button
                variant="ghost"
                className="w-full h-8 text-xs text-white/50 hover:text-white hover:bg-white/[0.05]"
                onClick={() => setIsOpen(false)}
              >
                Close notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
