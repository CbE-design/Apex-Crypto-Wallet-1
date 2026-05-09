
'use server';

import {getAuth} from 'firebase-admin/auth';
import {z, defineFlow, run} from 'genkit';
import {getFirestore} from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK if not already done
import {firebaseAdmin} from '@/lib/firebase-admin';

export const getAuthToken = defineFlow(
  {
    name: 'getAuthToken',
    inputSchema: z.object({address: z.string()}),
    outputSchema: z.string(),
  },
  async ({address}) => {
    const db = getFirestore(firebaseAdmin);
    const usersRef = db.collection('users');
    // Always query by lowercase address for consistency
    const q = usersRef.where('walletAddressLowercase', '==', address.toLowerCase()).limit(1);
    const snapshot = await run('find-user', () => q.get());

    if (snapshot.empty) {
      throw new Error('User not found');
    }

    const user = snapshot.docs[0];
    const token = await run('create-token', () =>
      getAuth(firebaseAdmin).createCustomToken(user.id)
    );

    return token;
  }
);
