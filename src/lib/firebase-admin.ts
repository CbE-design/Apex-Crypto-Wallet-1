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
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[firebase-admin] Initialized using FIREBASE_ADMIN_SDK_CONFIG');
      return;
    } catch (e) {
      console.error('[firebase-admin] Failed to parse FIREBASE_ADMIN_SDK_CONFIG:', e);
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      // Robust private key formatting
      // 1. Remove literal quotes if they were included by the env loader
      privateKey = privateKey.trim();
      
      // If the string starts with a quote, we need to handle it carefully.
      // Environment variables from different platforms handle quotes differently.
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      
      // 2. The most important part: literal \n characters (backslash + n) 
      // must be converted to real newline characters for the decoder to work.
      privateKey = privateKey.replace(/\\n/g, '\n');

      // 3. Ensure the key has the correct headers/footers
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}`;
      }
      if (!privateKey.includes('-----END PRIVATE KEY-----')) {
        privateKey = `${privateKey}\n-----END PRIVATE KEY-----`;
      }

      admin.initializeApp({
        credential: admin.credential.cert({ 
          projectId, 
          clientEmail, 
          privateKey 
        }),
        databaseURL: `https://${projectId}.firebaseio.com`,
      });
      console.log('[firebase-admin] Initialized using individual environment variables');
      return;
    } catch (e) {
      console.error('[firebase-admin] Failed to initialize with environment variables:', e);
    }
  }

  console.warn('[firebase-admin] No Firebase Admin credentials found or initialization failed. Admin features will be disabled.');
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
