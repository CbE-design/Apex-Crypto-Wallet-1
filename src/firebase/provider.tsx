'use client';

import React, { createContext, useContext, useMemo, type DependencyList } from 'react';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

const FirebaseContext = createContext<FirebaseApp | undefined>(undefined);
const AuthContext = createContext<Auth | undefined>(undefined);
const FirestoreContext = createContext<Firestore | undefined>(undefined);

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const firestore = getFirestore(app);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <FirebaseContext.Provider value={app}>
      <AuthContext.Provider value={auth}>
        <FirestoreContext.Provider value={firestore}>
          {children}
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

/**
 * Memoize a Firebase reference (collection, query, or doc) so it has a
 * stable identity across renders. Required by useCollection / useDoc to
 * avoid re-subscribing on every render.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
