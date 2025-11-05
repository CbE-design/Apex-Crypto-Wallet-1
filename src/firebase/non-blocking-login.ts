
'use client';

import { Auth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { UserCredential } from 'firebase/auth';

/**
 * Initiates an anonymous sign-in process with Firebase Authentication.
 * This is a non-blocking operation that returns a promise, allowing the UI
 * to remain responsive while authentication happens in the background.
 *
 * @param auth - The Firebase Auth instance.
 * @param uid - Optional user ID to associate with the anonymous session.
 * @returns A promise that resolves with the UserCredential on successful sign-in.
 */
export async function initiateAnonymousSignIn(auth: Auth, uid?: string): Promise<UserCredential> {
  // In a real application, you would generate a custom token on your server
  // that includes the UID as a claim. For this simulation, we will sign in
  // anonymously and trust the client to manage the correct user context.
  // This is NOT a secure practice for a production application.
  return signInAnonymously(auth);
}
