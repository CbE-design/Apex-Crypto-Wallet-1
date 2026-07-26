
import 'server-only';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const REQUIRED_SERVICE_ACCOUNT_FIELDS = ['project_id', 'client_email', 'private_key'] as const;

// Produce a diagnostic summary of the raw config WITHOUT leaking the secret's
// contents, so misconfiguration can be pinpointed from logs alone.
function describeConfigValue(raw: string): string {
  const trimmed = raw.trim();
  const first = trimmed[0] ?? '';
  const last = trimmed[trimmed.length - 1] ?? '';
  const looksQuoteWrapped =
    (first === '"' && last === '"') || (first === "'" && last === "'");
  return [
    `length=${raw.length}`,
    `startsWith=${JSON.stringify(first)}`,
    `endsWith=${JSON.stringify(last)}`,
    looksQuoteWrapped ? 'appears wrapped in extra quotes' : null,
    /\\n/.test(raw) ? 'contains escaped \\n' : 'no escaped \\n found',
    raw.includes('BEGIN PRIVATE KEY') ? 'contains private key marker' : 'no private key marker',
  ]
    .filter(Boolean)
    .join(', ');
}

// Validate a parsed service account has the fields the Admin SDK needs.
// Returns the list of missing fields (empty when valid).
function missingServiceAccountFields(serviceAccount: unknown): string[] {
  if (typeof serviceAccount !== 'object' || serviceAccount === null) {
    return [...REQUIRED_SERVICE_ACCOUNT_FIELDS];
  }
  const record = serviceAccount as Record<string, unknown>;
  return REQUIRED_SERVICE_ACCOUNT_FIELDS.filter(
    field => typeof record[field] !== 'string' || (record[field] as string).length === 0,
  );
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  // 1. Try environment variable
  const configJson = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  if (configJson) {
    let serviceAccount: unknown;
    try {
      serviceAccount = JSON.parse(configJson);
    } catch (e: any) {
      console.error(
        '[firebase-admin] WARNING: FIREBASE_ADMIN_SDK_CONFIG is not valid JSON and could not be parsed. ' +
          `Parser error: ${e.message}. Config value diagnostics: ${describeConfigValue(configJson)}. ` +
          'Expected the raw service-account JSON downloaded from Firebase Console > Project Settings > ' +
          'Service accounts. Falling back to file.',
      );
      serviceAccount = undefined;
    }

    if (serviceAccount !== undefined) {
      const missing = missingServiceAccountFields(serviceAccount);
      if (missing.length > 0) {
        console.error(
          '[firebase-admin] WARNING: FIREBASE_ADMIN_SDK_CONFIG parsed as JSON but is missing required ' +
            `field(s): ${missing.join(', ')}. Ensure the full service-account JSON is provided. Falling back to file.`,
        );
      } else {
        try {
          const projectId = (serviceAccount as Record<string, string>).project_id;
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
            databaseURL: `https://${projectId}.firebaseio.com`,
            storageBucket: `${projectId}.appspot.com`,
          });
          console.log(
            `[firebase-admin] Initialized successfully using FIREBASE_ADMIN_SDK_CONFIG env var (project_id=${projectId}).`,
          );
          return;
        } catch (e: any) {
          console.error(
            '[firebase-admin] WARNING: FIREBASE_ADMIN_SDK_CONFIG is valid JSON with all required fields, ' +
              `but admin.initializeApp failed: ${e.message}. This usually means the private_key is malformed ` +
              '(e.g. newlines not preserved as \\n). Falling back to file.',
          );
        }
      }
    }
  } else {
    console.warn('[firebase-admin] FIREBASE_ADMIN_SDK_CONFIG env var is not set. Trying service account file.');
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
  
  // 3. Critical failure or dev mode bypass
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[firebase-admin] DEV MODE: Firebase Admin initialization skipped. ' +
      'Admin SDK will not be available in dev server. Set FIREBASE_ADMIN_SDK_CONFIG or firebase-service-account.json to enable.'
    );
    return;
  }

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
