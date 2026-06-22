import 'server-only';
import * as admin from 'firebase-admin';

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  const configJson = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (configJson) {
    try {
      // The config is expected to be a stringified JSON object.
      const serviceAccount = JSON.parse(configJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
      });
      console.log('[firebase-admin] Initialized using FIREBASE_ADMIN_SDK_CONFIG');
      return;
    } catch (e) {
      console.error('[firebase-admin] Failed to parse or use FIREBASE_ADMIN_SDK_CONFIG:', e);
      // Fall through to the warning
    }
  }

  console.error(
    '[firebase-admin] CRITICAL: Firebase Admin initialization failed. ' +
    'The FIREBASE_ADMIN_SDK_CONFIG environment variable is missing or invalid. ' +
    'Admin features will be disabled.'
  );
}

initializeFirebaseAdmin();

export const firebaseAdmin = admin;

export function getAdminFirestore(): admin.firestore.Firestore | null {
  if (!admin.apps.length) return null;
  try {
    return admin.firestore();
  } catch {
    return null;
  }
}

export function getAdminMessaging(): admin.messaging.Messaging | null {
  if (!admin.apps.length) return null;
  try {
    return admin.messaging();
  } catch {
    return null;
  }
}
