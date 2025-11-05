'use client';

import { Auth, signInAnonymously } from 'firebase/auth';

/**
 * Initiates an anonymous sign-in process with Firebase Authentication.
 * This is a non-blocking operation that returns a promise, allowing the UI
 * to remain responsive while authentication happens in the background.
 *
 * @param auth - The Firebase Auth instance.
 * @returns A promise that resolves with the UserCredential on successful sign-in.
 */
export function initiateAnonymousSignIn(auth: Auth) {
  return signInAnonymously(auth);
}
