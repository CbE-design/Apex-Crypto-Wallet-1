'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export type NotificationCategory = 'general' | 'market' | 'security' | 'system' | 'promotion';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// A unified interface for all notification types
export interface MergedNotification {
  id: string;
  title: string;
  message: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  sender?: string;
  read: boolean;
  createdAt: Timestamp;
  isBroadcast: boolean;
  sentCount?: number;
  failureCount?: number;
}

export function useNotificationBell(currentUserId: string | undefined) {
  const firestore = useFirestore();

  // State for each individual stream
  const [personalNotifications, setPersonalNotifications] = useState<MergedNotification[]>([]);
  const [broadcasts, setBroadcasts] = useState<MergedNotification[]>([]);
  const [deletedBroadcastIds, setDeletedBroadcastIds] = useState<Set<string>>(new Set());
  const [readBroadcastIds, setReadBroadcastIds] = useState<Set<string>>(new Set());

  // Final merged and filtered state
  const [mergedNotifications, setMergedNotifications] = useState<MergedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Effect for USER-DEPENDENT listeners
  useEffect(() => {
    if (!currentUserId) {
        setPersonalNotifications([]);
        setDeletedBroadcastIds(new Set());
        setReadBroadcastIds(new Set());
        return;
    }

    const personalQuery = query(collection(firestore, 'notifications'), where('userId', '==', currentUserId), orderBy('createdAt', 'desc'));
    const deletedQuery = collection(firestore, 'users', currentUserId, 'deletedBroadcasts');
    const readQuery = collection(firestore, 'users', currentUserId, 'broadcastReads');

    const unsubPersonal = onSnapshot(personalQuery, (snapshot) => {
        const personal = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id,
          isBroadcast: false,
          body: d.data().body || d.data().message || '',
          category: d.data().category || 'general',
          priority: d.data().priority || 'normal',
        })) as MergedNotification[];
        setPersonalNotifications(personal);
    }, (error) => {
        console.error("Error fetching personal notifications:", error);
    });

    const unsubDeleted = onSnapshot(deletedQuery, (snapshot) => {
        const deletedIds = new Set(snapshot.docs.map(d => d.id));
        setDeletedBroadcastIds(deletedIds);
    }, (error) => {
        console.error("Error fetching deleted broadcasts:", error);
    });

    const unsubRead = onSnapshot(readQuery, (snapshot) => {
        const readIds = new Set(snapshot.docs.map(d => d.id));
        setReadBroadcastIds(readIds);
    }, (error) => {
        console.error("Error fetching read broadcasts:", error);
    });

    return () => {
        setTimeout(() => {
            unsubPersonal();
            unsubDeleted();
            unsubRead();
        }, 150);
    };
  }, [currentUserId, firestore]);

  // Effect for GLOBAL, user-independent listeners
  useEffect(() => {
    const broadcastsQuery = query(collection(firestore, 'broadcasts'), orderBy('createdAt', 'desc'));

    const unsubBroadcasts = onSnapshot(broadcastsQuery, (snapshot) => {
        const fetchedBroadcasts = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id,
          isBroadcast: true,
          body: d.data().body || d.data().message || '',
          category: d.data().category || 'general',
          priority: d.data().priority || 'normal',
          sender: d.data().sender || 'Apex Admin',
        })) as MergedNotification[];
        setBroadcasts(fetchedBroadcasts);
    }, (error) => {
        console.error("Error fetching broadcasts:", error);
    });

    return () => {
        setTimeout(() => {
            unsubBroadcasts();
        }, 150);
    };
  }, [firestore]);

  // Effect to merge and filter the streams when any of them change
  useEffect(() => {
    const activeBroadcasts = broadcasts
      .filter(b => !deletedBroadcastIds.has(b.id))
      .map(b => ({ ...b, read: readBroadcastIds.has(b.id) }));
    const all = [...personalNotifications, ...activeBroadcasts];

    all.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    setMergedNotifications(all);
    setUnreadCount(all.filter(n => !n.read).length);
  }, [personalNotifications, broadcasts, deletedBroadcastIds, readBroadcastIds]);

  const markAsRead = async (notification: MergedNotification) => {
    if (!currentUserId) return;

    try {
      if (notification.isBroadcast) {
        const readRef = doc(firestore, 'users', currentUserId, 'broadcastReads', notification.id);
        await setDoc(readRef, { readAt: serverTimestamp() });
      } else {
        const notificationRef = doc(firestore, 'notifications', notification.id);
        await updateDoc(notificationRef, { read: true });
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const deleteNotification = async (notification: MergedNotification) => {
    if (!currentUserId) {
      console.error("Cannot delete notification: user ID is missing.");
      return;
    }

    try {
      if (notification.isBroadcast) {
        const softDeleteRef = doc(firestore, "users", currentUserId, "deletedBroadcasts", notification.id);
        await setDoc(softDeleteRef, { deletedAt: serverTimestamp() });
      } else {
        const hardDeleteRef = doc(firestore, "notifications", notification.id);
        await deleteDoc(hardDeleteRef);
      }
    } catch (error) {
      console.error(`Failed to delete notification ${notification.id}:`, error);
    }
  };

  return { notifications: mergedNotifications, unreadCount, markAsRead, deleteNotification };
}
