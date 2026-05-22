'use server';

import { ai } from '@/ai/genkit';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';
import {
  SendNotificationInputSchema,
  SendNotificationOutputSchema,
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
  async ({ title, body }) => {
    const db = getAdminFirestore();
    const messaging = getAdminMessaging();

    if (!db || !messaging) {
      throw new Error('Firebase Admin SDK is not initialized. Cannot send notifications.');
    }

    const usersSnapshot = await db.collection('users').get();

    const tokens: string[] = [];
    usersSnapshot.forEach(docSnap => {
      const userData = docSnap.data();
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken as string);
      }
    });

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const message = {
      notification: { title, body },
      tokens,
    };

    try {
      // firebase-admin v10 uses sendMulticast; v11+ uses sendEachForMulticast
      const response = await messaging.sendMulticast(message);
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('Error sending notifications:', error);
      return { successCount: 0, failureCount: tokens.length };
    }
  },
);
