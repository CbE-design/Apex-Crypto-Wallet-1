'use server';

import { z } from 'zod';
import { ai } from '../genkit';
import { getAdminFirestore, firebaseAdmin } from '@/lib/firebase-admin';

/**
 * Genkit flow that issues a Firebase custom auth token for a wallet address.
 * Looks up an existing user by walletAddressLowercase, creates one if not found,
 * and returns { token, isReturningUser }.
 *
 * NOTE: The primary implementation is the Next.js API route at
 * /api/auth/wallet-token which is called directly by wallet-context.tsx.
 * This flow exists for server-action / Genkit pipeline usage.
 */
export const getAuthToken = ai.defineFlow(
  {
    name: 'getAuthToken',
    inputSchema: z.object({ address: z.string() }),
    outputSchema: z.object({
      token: z.string(),
      isReturningUser: z.boolean(),
    }),
  },
  async ({ address }: { address: string }) => {
    const db = getAdminFirestore();
    if (!db) {
      throw new Error('Firebase Admin SDK is not initialised.');
    }

    const addressLower = address.toLowerCase();
    const snap = await db
      .collection('users')
      .where('walletAddressLowercase', '==', addressLower)
      .limit(1)
      .get();

    let uid: string;
    let isReturningUser: boolean;

    if (snap.empty) {
      isReturningUser = false;
      uid = `w_${addressLower.replace('0x', '').slice(0, 40)}`;
    } else {
      isReturningUser = true;
      uid = snap.docs[0].id;
    }

    const token = await firebaseAdmin.auth().createCustomToken(uid, { walletAddress: address });
    return { token, isReturningUser };
  },
);
