
import 'server-only';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  // 1. Try environment variable
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
      console.log('[firebase-admin] Initialized successfully using FIREBASE_ADMIN_SDK_CONFIG env var.');
      return;
    } catch (e: any) {
      console.error('[firebase-admin] WARNING: Failed to parse FIREBASE_ADMIN_SDK_CONFIG. Falling back to file.', e.message);
    }
  }

  // 2. Try service account file
  try {
    const serviceAccountPath = path.resolve('./firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      const projectId = serviceAccount.project_id;
       admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${projectId}.firebaseio.com`,
        storageBucket: `${projectId}.appspot.com`,
      });
      console.log('[firebase-admin] Initialized successfully using firebase-service-account.json file.');
      return;
    }
  } catch (e: any) {
    console.error('[firebase-admin] WARNING: Failed to initialize with service account file.', e.message);
  }
  
  // 3. Critical failure
  console.error(
    '[firebase-admin] CRITICAL: Firebase Admin initialization failed. ' +
    'Could not find credentials. Please set FIREBASE_ADMIN_SDK_CONFIG or create a valid firebase-service-account.json file in the project root.'
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
