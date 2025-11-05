
'use server';
/**
 * @fileOverview A flow for sending push notifications to all users.
 *
 * - sendNotification - A function that sends a message to all users with a valid FCM token.
 * - SendNotificationInput - The input type for the sendNotification function.
 * - SendNotificationOutput - The return type for the sendNotification function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';

// Define Zod schemas for input and output
export const SendNotificationInputSchema = z.object({
  title: z.string().describe('The title of the notification.'),
  body: z.string().describe('The body content of the notification.'),
});
export type SendNotificationInput = z.infer<typeof SendNotificationInputSchema>;

export const SendNotificationOutputSchema = z.object({
  successCount: z.number().describe('The number of messages that were sent successfully.'),
  failureCount: z.number().describe('The number of messages that could not be sent.'),
});
export type SendNotificationOutput = z.infer<typeof SendNotificationOutputSchema>;


// Helper to initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (getApps().length) {
    return;
  }
  
  if (!process.env.FIREBASE_ADMIN_SDK_CONFIG) {
    console.warn("FIREBASE_ADMIN_SDK_CONFIG is not set. Skipping Firebase Admin initialization.");
    return;
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_CONFIG);
    initializeApp({
        credential: cert(serviceAccount)
    });
  } catch(e) {
      console.error("Could not initialize Firebase Admin SDK. Make sure FIREBASE_ADMIN_SDK_CONFIG is set in .env", e);
      throw new Error("Admin SDK initialization failed.");
  }
}

// Exported wrapper function
export async function sendNotification(input: SendNotificationInput): Promise<SendNotificationOutput> {
  return sendNotificationFlow(input);
}


// Define the Genkit flow
const sendNotificationFlow = ai.defineFlow(
  {
    name: 'sendNotificationFlow',
    inputSchema: SendNotificationInputSchema,
    outputSchema: SendNotificationOutputSchema,
  },
  async ({ title, body }) => {
    initializeFirebaseAdmin();

    // Check if the admin app was initialized before proceeding
    if (!getApps().length) {
        throw new Error("Firebase Admin SDK is not initialized. Cannot send notifications.");
    }
    
    const db = getFirestore();
    const messaging = getMessaging();

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
