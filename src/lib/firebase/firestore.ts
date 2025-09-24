
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from './config';
import type { User } from 'firebase/auth';

// --- Admin Configuration ---
// For this prototype, we'll hardcode the admin email.
// In a production app, you would manage roles in a secure backend.
const ADMIN_EMAIL = 'corrie27@yahoo.com';

// Function to generate a random Ethereum-like address
const generateWalletAddress = (): string => {
  const hexChars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return address;
};


export const createUserProfile = async (user: User) => {
  if (!firestore) throw new Error("Firestore not initialized");
  const userRef = doc(firestore, 'users', user.uid);
  
  const userProfile: { [key: string]: any } = {
    email: user.email,
    createdAt: new Date(),
    walletAddress: generateWalletAddress(),
  };
  
  // Check if the new user's email matches the admin email
  if (user.email === ADMIN_EMAIL) {
    userProfile.isAdmin = true;
  }

  await setDoc(userRef, userProfile);
};

export const getUserProfile = async (userId: string) => {
    if (!firestore) return null;
    const userRef = doc(firestore, 'users', userId);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        console.log("No such document!");
        return null;
    }
}
