'use client';

import React, { createContext, useContext, useMemo, type DependencyList } from 'react';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

const FirebaseContext = createContext<FirebaseApp | undefined>(undefined);
const AuthContext = createContext<Auth | undefined>(undefined);
const FirestoreContext = createContext<Firestore | undefined>(undefined);
const StorageContext = createContext<FirebaseStorage | undefined>(undefined);

let app: FirebaseApp;
let firestore: Firestore;
let storage: FirebaseStorage;

// Ensure consistent initialization
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Using initializeFirestore ensures settings like forceLongPolling are applied
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true, // Fixes WebChannel stream errors
  });
  storage = getStorage(app);
} else {
  app = getApp();
  // Even if app exists, try to get the existing firestore or initialize if needed
  try {
    firestore = getFirestore(app);
  } catch {
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalForceLongPolling: true,
    });
  }
  storage = getStorage(app);
}

const auth = getAuth(app);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <FirebaseContext.Provider value={app}>
      <AuthContext.Provider value={auth}>
        <FirestoreContext.Provider value={firestore}>
          <StorageContext.Provider value={storage}>
            {children}
          </StorageContext.Provider>
        </FirestoreContext.Provider>
      </AuthContext.Provider>
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within a FirebaseProvider");
  }
  return context;
};

export const useFirestore = () => {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error("useFirestore must be used within a FirebaseProvider");
  }
  return context;
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error("useStorage must be used within a FirebaseProvider");
  }
  return context;
};

/**
 * Memoize a Firebase reference (collection, query, or doc) so it has a
 * stable identity across renders. Required by useCollection / useDoc to
 * avoid re-subscribing on every render.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
