
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
  type Auth
} from 'firebase/auth';
import { firebaseApp } from './config';
import { createUserProfile } from './firestore';

let auth: Auth | null = null;
if (firebaseApp) {
    auth = getAuth(firebaseApp);
}


export const signUpWithEmail = async (email: string, password: string): Promise<void> => {
  if (!auth) throw new Error("Firebase not initialized");
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  // This will likely cause a permission error, but it's the state we are reverting to.
  await createUserProfile(userCredential.user);
};

export const signInWithEmail = (email: string, password: string): Promise<any> => {
  if (!auth) throw new Error("Firebase not initialized");
  return signInWithEmailAndPassword(auth, email, password);
};

export const handleSignOut = (): Promise<void> => {
  if (!auth) throw new Error("Firebase not initialized");
  return signOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {}; // Return an empty unsubscribe function
  }
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = (): User | null => {
    if (!auth) return null;
    return auth.currentUser;
}
