
'use server';
/**
 * @fileOverview A flow for sending push notifications to all users.
 */

import { ai } from '@/ai/genkit';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';
import { 
  SendNotificationInputSchema, 
  SendNotificationOutputSchema, 
  type SendNotificationInput, 
  type SendNotificationOutput 
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
      throw new Error("Firebase Admin SDK is not initialized. Cannot send notifications.");
    }
    
    // 1. Fetch all users
    const usersSnapshot = await db.collection('users').get();
    
    // 2. Filter for users with an fcmToken
    const tokens: string[] = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    // 3. Send multicast message
    const message = {
      notification: {
        title,
        body,
      },
      tokens: tokens,
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('Error sending notifications:', error);
      return { successCount: 0, failureCount: tokens.length };
    }
  }
);
