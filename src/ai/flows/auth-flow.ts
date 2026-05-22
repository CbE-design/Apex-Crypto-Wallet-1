
'use server';

import { getAuth } from 'firebase-admin/auth';
import { z, defineFlow, run } from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK if not already done
import { firebaseAdmin } from '@/lib/firebase-admin';

export const getAuthToken = defineFlow(
  {
    name: 'getAuthToken',
    inputSchema: z.object({ address: z.string() }),
    // The output is an object containing the token and a flag indicating
    // if the user is new or returning, which is crucial for the client.
    outputSchema: z.object({
      token: z.string(),
      isReturningUser: z.boolean(),
    }),
  },
  async ({ address }) => {
    const auth = getAuth(firebaseAdmin);
    const db = getFirestore(firebaseAdmin);
    const usersRef = db.collection('users');

    // Query for an existing user with the same wallet address.
    const q = usersRef.where('walletAddressLowercase', '==', address.toLowerCase()).limit(1);
    const snapshot = await run('find-user', () => q.get());

    let userId: string;
    let isReturningUser: boolean;

    if (snapshot.empty) {
      // CASE 1: New User
      // The user does not exist, so we create a new Firebase Auth user.
      // This provides a new, unique, and secure UID for them.
      isReturningUser = false;
      const newUser = await run('create-auth-user', () => auth.createUser({
        // We don't have email/password, just create a user to get a UID
      }));
      userId = newUser.uid;
    } else {
      // CASE 2: Returning User
      // The user already exists. We'll use their original UID to ensure
      // they get access to all their existing data.
      isReturningUser = true;
      userId = snapshot.docs[0].id;
    }

    // Now, create the custom token with the determined UID.
    // Including the walletAddress as a claim is a good security practice.
    const token = await run('create-token', () =>
      auth.createCustomToken(userId, { walletAddress: address })
    );

    // Return the token and the flag to the client.
    return { token, isReturningUser };
  }
);
