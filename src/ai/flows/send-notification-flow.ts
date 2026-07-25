'use server';

import { ai } from '../genkit';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';
import {
  SendNotificationInputSchema,
  SendNotificationOutputSchema,
  NotificationCategorySchema,
  NotificationPrioritySchema,
  type SendNotificationInput,
  type SendNotificationOutput,
} from '@/lib/types';

export async function sendNotification(input: SendNotificationInput): Promise<SendNotificationOutput> {
  return sendNotificationFlow(input);
}

const sendNotificationFlow = ai.defineFlow(
  {
    name: 'sendNotificationFlow',
    inputSchema: SendNotificationInputSchema,
    outputSchema: SendNotificationOutputSchema,
  },
  async ({ title, body, category = 'general', priority = 'normal', sender }: SendNotificationInput) => {
    const db = getAdminFirestore();
    const messaging = getAdminMessaging();

    if (!db || !messaging) {
      throw new Error('Firebase Admin SDK is not initialized. Cannot send notifications.');
    }

    // 1. Persist the broadcast so it appears in every user's in-app notification list.
    let broadcastId: string | undefined;
    try {
      const broadcastRef = await db.collection('broadcasts').add({
        title,
        body,
        message: body,
        category: NotificationCategorySchema.parse(category),
        priority: NotificationPrioritySchema.parse(priority),
        sender: sender || 'Apex Admin',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      broadcastId = broadcastRef.id;
    } catch (error) {
      console.error('Failed to persist broadcast notification:', error);
    }

    // 2. Collect FCM tokens and send push notifications.
    const usersSnapshot = await db.collection('users').get();

    const tokens: string[] = [];
    usersSnapshot.forEach(docSnap => {
      const userData = docSnap.data();
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken as string);
      }
    });

    let successCount = 0;
    let failureCount = 0;

    if (tokens.length > 0) {
      const message = {
        notification: { title, body },
        data: {
          category,
          priority,
          sender: sender || 'Apex Admin',
          broadcastId: broadcastId || '',
        },
        tokens,
      };

      try {
        // Modern firebase-admin uses sendEachForMulticast
        const response = await (messaging as any).sendEachForMulticast(message);
        successCount = response.successCount || 0;
        failureCount = response.failureCount || 0;

        // Update the broadcast with final delivery stats.
        if (broadcastId) {
          try {
            await db.collection('broadcasts').doc(broadcastId).update({
              sentCount: successCount,
              failureCount: failureCount,
            });
          } catch (_) {}
        }
      } catch (error) {
        console.error('Error sending FCM notifications:', error);
        failureCount = tokens.length;
      }
    }

    return { successCount, failureCount, broadcastId };
  },
);
