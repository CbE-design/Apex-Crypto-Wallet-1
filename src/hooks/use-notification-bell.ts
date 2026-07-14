
import { useMemo, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  setDoc,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';

// --- Type Definitions ---

// Document shape in /notifications
interface DirectNotificationDoc {
  recipientId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp;
}

// Document shape in /broadcasts
interface BroadcastNotificationDoc {
  title: string;
  body: string;
  createdAt: Timestamp;
}

// The final, merged notification object the hook returns
export interface Notification {
  id: string;
  type: 'direct' | 'broadcast';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}

/**
 * A custom hook to manage real-time notifications for a user.
 *
 * @param currentUserId The ID of the currently logged-in user.
 * @returns An object with the merged notifications, unread count, and a function to mark notifications as read.
 */
export const useNotificationBell = (currentUserId?: string | null) => {
  const firestore = useFirestore();

  // 1. Create memoized Firestore queries
  const directQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserId) return null;
    return query(
      collection(firestore, 'notifications'),
      where('recipientId', '==', currentUserId),
      orderBy('createdAt', 'desc'),
      limit(25) // Limits to the 25 most recent direct notifications
    );
  }, [firestore, currentUserId]);

  const broadcastsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Note: This query requires a single-field index on `broadcasts.createdAt` (desc).
    // Firestore will provide a link in the console error to create this automatically.
    return query(collection(firestore, 'broadcasts'), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore]);

  const readBroadcastsQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserId) return null;
    return collection(firestore, 'users', currentUserId, 'readBroadcasts');
  }, [firestore, currentUserId]);

  // 2. Establish real-time listeners with your custom useCollection hook
  const { data: directNotifications } = useCollection<DirectNotificationDoc>(directQuery);
  const { data: broadcastNotifications } = useCollection<BroadcastNotificationDoc>(broadcastsQuery);
  const { data: readBroadcasts } = useCollection(readBroadcastsQuery);

  // 3. Memoize the merging and processing logic
  const { notifications, unreadCount } = useMemo(() => {
    if (!directNotifications || !broadcastNotifications || !readBroadcasts) {
      return { notifications: [], unreadCount: 0 };
    }

    const readBroadcastIds = new Set(readBroadcasts.map(b => b.id));

    const processedDirect: Notification[] = directNotifications.map(n => ({
      id: n.id,
      type: 'direct',
      title: n.title,
      body: n.body,
      isRead: n.read,
      createdAt: n.createdAt.toDate(),
    }));

    const processedBroadcasts: Notification[] = broadcastNotifications.map(b => ({
      id: b.id,
      type: 'broadcast',
      title: b.title,
      body: b.body,
      isRead: readBroadcastIds.has(b.id),
      createdAt: b.createdAt.toDate(),
    }));

    const all = [...processedDirect, ...processedBroadcasts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const unread = all.filter(n => !n.isRead).length;

    return { notifications: all, unreadCount: unread };
  }, [directNotifications, broadcastNotifications, readBroadcasts]);

  // 4. Create a memoized function to mark notifications as read
  const markAsRead = useCallback(async (notification: Notification) => {
    if (!firestore || !currentUserId || notification.isRead) return;

    try {
      if (notification.type === 'direct') {
        await updateDoc(doc(firestore, 'notifications', notification.id), { read: true });
      } else if (notification.type === 'broadcast') {
        await setDoc(doc(firestore, 'users', currentUserId, 'readBroadcasts', notification.id), {});
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, [firestore, currentUserId]);

  return { notifications, unreadCount, markAsRead };
};
