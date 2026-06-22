import 'server-only';
import * as admin from 'firebase-admin';

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  const configJson = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (configJson) {
    try {
<<<<<<< HEAD
      // Diagnostic log to help find syntax errors in Secret Manager without exposing the key
      const start = (configJson || '').substring(0, 15);
      console.log(`[firebase-admin] Attempting to parse config. Length: ${configJson.length}. Starts with: ${start}...`);
      
=======
>>>>>>> 0acf6f43fd48da9f1f9b15e7ba3bd9879ce27650
      const serviceAccount = JSON.parse(configJson);
      const projectId = serviceAccount.project_id;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${projectId}.firebaseio.com`,
        storageBucket: `${projectId}.appspot.com`,
      });
      console.log('[firebase-admin] Initialized successfully using FIREBASE_ADMIN_SDK_CONFIG');
      return;
<<<<<<< HEAD
    } catch (e: any) {
      console.error('[firebase-admin] CRITICAL: Failed to parse FIREBASE_ADMIN_SDK_CONFIG. Check your Secret Manager formatting.', e.message);
=======
    } catch (e) {
      console.error('[firebase-admin] Failed to parse or use FIREBASE_ADMIN_SDK_CONFIG:', e);
>>>>>>> 0acf6f43fd48da9f1f9b15e7ba3bd9879ce27650
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

export function getAdminStorage(): admin.storage.Storage | null {
  if (!admin.apps.length) return null;
  try {
    return admin.storage();
  } catch {
    return null;
  }
}
