import { getAdminFirestore } from "./firebase-admin";
import type * as admin from "firebase-admin";

// Returns the Firestore instance lazily.
// Using a function (rather than a module-level constant) means that importing
// this module at Next.js build time does NOT trigger Firebase Admin
// initialisation — which would crash when credentials are absent in CI/CD.
export function getDb(): admin.firestore.Firestore {
  const instance = getAdminFirestore();
  if (!instance) {
    throw new Error(
      "[db] Firebase Admin is not initialised. " +
        "Ensure FIREBASE_ADMIN_SDK_CONFIG is set in your environment variables."
    );
  }
  return instance;
}
