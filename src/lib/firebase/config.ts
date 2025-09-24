
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration should be in your .env files
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if the API key is provided
let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;

if (firebaseConfig.apiKey) {
    firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    firestore = getFirestore(firebaseApp);
} else {
    console.warn("Firebase configuration is missing. Firebase services will be disabled.");
}


export { firebaseApp, firestore };
