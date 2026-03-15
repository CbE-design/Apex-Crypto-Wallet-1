
'use server';
/**
 * @fileOverview A flow for sending emails to all users.
 *
 * - sendEmail - A function that sends an email to all users with a valid email address.
 */

import { ai } from '@/ai/genkit';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { Resend } from 'resend';
import { 
  SendEmailInputSchema, 
  SendEmailOutputSchema, 
  type SendEmailInput, 
  type SendEmailOutput 
} from '@/lib/types';

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
export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
  return sendEmailFlow(input);
}


// Define the Genkit flow
const sendEmailFlow = ai.defineFlow(
  {
    name: 'sendEmailFlow',
    inputSchema: SendEmailInputSchema,
    outputSchema: SendEmailOutputSchema,
  },
  async ({ subject, body }) => {
    
    // 1. Check for API Keys
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
        const message = "Email configuration is incomplete. Please set RESEND_API_KEY and FROM_EMAIL in your .env file.";
        console.error(message);
        return { success: false, message };
    }

    // 2. Initialize Services
    initializeFirebaseAdmin();
    if (!getApps().length) {
        throw new Error("Firebase Admin SDK is not initialized. Cannot fetch user emails.");
    }
    const db = getFirestore();
    const resend = new Resend(resendApiKey);

    // 3. Fetch all users
    const usersSnapshot = await db.collection('users').get();
    
    // 4. Filter for users with a valid email address
    const emails: string[] = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      // Simple email validation
      if (userData.email && userData.email.includes('@')) {
        emails.push(userData.email);
      }
    });

    if (emails.length === 0) {
      return { success: true, message: "No users with valid email addresses found to send to." };
    }

    // 5. Send email via Resend
    try {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: emails, // Resend handles batching
        subject: subject,
        html: body,
      });

      if (error) {
        console.error('Resend API Error:', error);
        return { success: false, message: `Failed to send emails: ${error.message}` };
      }

      return { success: true, message: `Email campaign successfully sent to ${emails.length} users.` };
    } catch (error) {
      console.error('Error sending emails:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { success: false, message: `Failed to dispatch emails: ${errorMessage}` };
    }
  }
);
