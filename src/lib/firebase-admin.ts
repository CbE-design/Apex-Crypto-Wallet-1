
/**
 * @fileOverview Centralized Firebase Admin SDK initialization.
 * Ensures the Admin SDK is initialized correctly across all server-side environments.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Initializes the Firebase Admin SDK using the FIREBASE_ADMIN_SDK_CONFIG environment variable.
 * @returns The initialized Firebase App instance or null if configuration is missing or invalid.
 */
export function initializeFirebaseAdmin(): App | null {
  // Return existing app if already initialized
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const config = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (!config) {
    console.warn("FIREBASE_ADMIN_SDK_CONFIG is not set. Admin services operating in Disconnected Mode.");
    return null;
  }

  try {
    // 1. Sanitize the string: remove potential wrapping quotes
    const sanitizedConfig = config.trim().replace(/^['"]|['"]$/g, '');
    
    // 2. Parse the JSON
    const serviceAccount = JSON.parse(sanitizedConfig);
    
    // 3. Fix private key formatting: ensure \n sequences are actual newlines
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    // 4. Initialize the app
    return initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Critical Failure: Could not parse or initialize FIREBASE_ADMIN_SDK_CONFIG. Check formatting.", error);
    return null;
  }
}

/**
 * Safely retrieves the Admin Firestore instance.
 */
export function getAdminFirestore() {
  const app = initializeFirebaseAdmin();
  if (!app) return null;
  return getFirestore(app);
}

/**
 * Safely retrieves the Admin Messaging instance.
 */
export function getAdminMessaging() {
  const app = initializeFirebaseAdmin();
  if (!app) return null;
  return getMessaging(app);
}
