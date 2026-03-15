
'use server';
/**
 * @fileOverview A flow for sending emails to all users.
 */

import { ai } from '@/ai/genkit';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { 
  SendEmailInputSchema, 
  SendEmailOutputSchema, 
  type SendEmailInput, 
  type SendEmailOutput 
} from '@/lib/types';

export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
  return sendEmailFlow(input);
}

const sendEmailFlow = ai.defineFlow(
  {
    name: 'sendEmailFlow',
    inputSchema: SendEmailInputSchema,
    outputSchema: SendEmailOutputSchema,
  },
  async ({ subject, body }) => {
    
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
        const message = "Email configuration is incomplete. Please set RESEND_API_KEY and FROM_EMAIL in your .env file.";
        return { success: false, message };
    }

    const db = getAdminFirestore();
    if (!db) {
        return { success: false, message: "Firebase Admin SDK is not initialized. Check server environment variables." };
    }
    
    const resend = new Resend(resendApiKey);

    const usersSnapshot = await db.collection('users').get();
    
    const emails: string[] = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.email && userData.email.includes('@')) {
        emails.push(userData.email);
      }
    });

    if (emails.length === 0) {
      return { success: true, message: "No users with valid email addresses found." };
    }

    try {
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: emails,
        subject: subject,
        html: body,
      });

      if (error) {
        return { success: false, message: `Resend Error: ${error.message}` };
      }

      return { success: true, message: `Email campaign successfully sent to ${emails.length} users.` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { success: false, message: `Failed to dispatch: ${errorMessage}` };
    }
  }
);
