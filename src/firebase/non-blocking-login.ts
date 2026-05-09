
'use client';

import { Auth, signInAnonymously, signOut } from 'firebase/auth';
import { UserCredential } from 'firebase/auth';

/**
 * Initiates an anonymous sign-in.
 * If a user is already signed in, signs them out first to get a fresh
 * anonymous session — necessary when re-importing after a disconnect.
 */
export async function initiateAnonymousSignIn(auth: Auth): Promise<UserCredential> {
  // If there is already a signed-in user, sign out first so we get a
  // clean anonymous session tied to no previous identity.
  if (auth.currentUser) {
    await signOut(auth);
  }
  return signInAnonymously(auth);
}
