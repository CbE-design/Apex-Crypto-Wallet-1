import 'server-only';
import * as admin from 'firebase-admin';

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  const configJson = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (configJson) {
    try {
      // Diagnostic log to help find syntax errors in Secret Manager without exposing the key
      const start = (configJson || '').substring(0, 15);
      console.log(`[firebase-admin] Attempting to parse config. Length: ${configJson.length}. Starts with: ${start}...`);
      
      const serviceAccount = JSON.parse(configJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
      });
      console.log('[firebase-admin] Initialized successfully using FIREBASE_ADMIN_SDK_CONFIG');
      return;
    } catch (e: any) {
      console.error('[firebase-admin] CRITICAL: Failed to parse FIREBASE_ADMIN_SDK_CONFIG. Check your Secret Manager formatting.', e.message);
    }
  }

  console.error(
    '[firebase-admin] CRITICAL: Firebase Admin initialization failed. ' +
    'The FIREBASE_ADMIN_SDK_CONFIG environment variable is missing or invalid.'
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
