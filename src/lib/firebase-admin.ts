import 'server-only';
import * as admin from 'firebase-admin';

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  const configJson = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (configJson) {
    try {
      const serviceAccount = JSON.parse(configJson);
      const projectId = serviceAccount.project_id;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${projectId}.firebaseio.com`,
        storageBucket: `${projectId}.appspot.com`,
      });
      console.log('[firebase-admin] Initialized using FIREBASE_ADMIN_SDK_CONFIG');
      return;
    } catch (e) {
      console.error('[firebase-admin] Failed to parse or use FIREBASE_ADMIN_SDK_CONFIG:', e);
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

export function getAdminStorage(): admin.storage.Storage | null {
  if (!admin.apps.length) return null;
  try {
    return admin.storage();
  } catch {
    return null;
  }
}
