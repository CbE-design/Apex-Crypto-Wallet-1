/**
 * @fileOverview Centralized Firebase Admin SDK initialization.
 * Ensures the Admin SDK is initialized correctly across all server-side environments.
 * Credential priority:
 *   1. FIREBASE_ADMIN_SDK_CONFIG env var (JSON string)
 *   2. firebase-service-account.json file in project root (gitignored)
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function loadServiceAccountConfig(): string | null {
  // Priority 1: environment variable
  let config = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  if (config) return config;

  // Priority 2: local gitignored file (Replit dev environment)
  try {
    // Dynamic require to avoid bundling issues with Next.js
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const filePath = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch {
    // Silently ignore file read errors
  }

  return null;
}

export function initializeFirebaseAdmin(): App | null {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const config = loadServiceAccountConfig();

  if (!config) {
    console.warn('[Firebase Admin] No credentials found. Set FIREBASE_ADMIN_SDK_CONFIG or place firebase-service-account.json in the project root. Admin services operating in Disconnected Mode.');
    return null;
  }

  try {
    const sanitizedConfig = config.trim().replace(/^['"]|['"]$/g, '');
    const serviceAccount = JSON.parse(sanitizedConfig);

    // Fix private key format — handles literal '\n' strings from env vars
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const app = initializeApp({ credential: cert(serviceAccount) });
    console.log('[Firebase Admin] Initialized successfully for project:', serviceAccount.project_id);
    return app;
  } catch (error) {
    console.error('[Firebase Admin] Critical Failure: Could not parse service account credentials.', error);
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
