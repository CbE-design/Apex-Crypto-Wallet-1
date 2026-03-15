
/**
 * @fileOverview Centralized Firebase Admin SDK initialization.
 * Ensures the Admin SDK is initialized correctly across all server-side environments.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export function initializeFirebaseAdmin(): App | null {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  let config = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (!config) {
    console.warn("FIREBASE_ADMIN_SDK_CONFIG is not set. Admin services operating in Disconnected Mode.");
    return null;
  }

  try {
    // Sanitize the config string (remove potential wrapping quotes from env loaders)
    const sanitizedConfig = config.trim().replace(/^['"]|['"]$/g, '');
    const serviceAccount = JSON.parse(sanitizedConfig);
    
    return initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Critical Failure: Could not parse FIREBASE_ADMIN_SDK_CONFIG JSON.", error);
    return null;
  }
}

export function getAdminFirestore() {
  const app = initializeFirebaseAdmin();
  if (!app) return null;
  return getFirestore(app);
}

export function getAdminMessaging() {
  const app = initializeFirebaseAdmin();
  if (!app) return null;
  return getMessaging(app);
}
