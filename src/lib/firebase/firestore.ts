import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { User } from 'firebase/auth';

export const createUserProfile = async (user: User) => {
  if (!firestore) throw new Error("Firestore is not initialized");
  const userRef = doc(firestore, `users/${user.uid}`);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    const { email } = user;
    try {
      await setDoc(userRef, {
        email,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error creating user profile:", error);
      throw new Error("Failed to create user profile.");
    }
  }
  return userRef;
};
