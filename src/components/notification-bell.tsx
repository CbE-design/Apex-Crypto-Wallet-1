'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationBell, MergedNotification } from '@/hooks/use-notification-bell';
import { useWallet } from '@/context/wallet-context';

export function NotificationBell() {
  // --- Hooks Section (Unconditional & Top-Level) ---
  const { user } = useWallet();
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotificationBell(user?.uid);
  const [isOpen, setIsOpen] = useState(false);

  // --- Event Handlers ---
  const handleToggle = () => {
    setIsOpen(prev => !prev);
  };

  const handleDelete = (notification: MergedNotification) => {
    if (deleteNotification) {
      deleteNotification(notification);
    }
  };

  const handleMarkAsRead = (notificationId: string) => {
    if (markAsRead) {
      markAsRead(notificationId);
    }
  };

  // --- Render Section ---
  // Render a disabled placeholder if the user is not authenticated.
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

  // Render the full component for authenticated users.
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition-colors relative"
        onClick={handleToggle}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500" />
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Notifications</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div key={notification.id} className="group p-2 border-b border-slate-800 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-white">{notification.title}</p>
                        <p className="text-xs text-slate-400">{notification.message}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full shrink-0 hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(notification)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {!notification.read && !notification.isBroadcast && (
                      <button
                        className="text-xs text-blue-400 hover:underline mt-2"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No new notifications.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
