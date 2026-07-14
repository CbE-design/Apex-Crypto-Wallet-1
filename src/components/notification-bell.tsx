'use client';
import { useNotificationBell } from '@/hooks/use-notification-bell';
import { useWallet } from '@/context/wallet-context'; // Or your auth context
import { BellIcon, Badge } from 'lucide-react'; // Example icons
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function NotificationBell() {
  const { user } = useWallet(); // Get current user
  const { unreadCount, notifications, markAsRead } = useNotificationBell(user?.uid);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative">
          {/* STEP 1: Use unreadCount to show a visual indicator */}
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 px-1.5 h-4 text-xs">
              {unreadCount}
            </Badge>
          )}
          <BellIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        {/* STEP 2: Map over 'notifications' to render the list */}
        {notifications.length === 0 ? (
          <p>No new notifications.</p>
        ) : (
          <ul>
            {notifications.map(notification => (
              <li
                key={notification.id}
                onClick={() => markAsRead(notification)} // STEP 3: Attach markAsRead to an action
                className={`p-2 rounded ${!notification.isRead ? 'font-bold' : ''}`}>
                <p>{notification.title}</p>
                <p className="text-sm">{notification.body}</p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
