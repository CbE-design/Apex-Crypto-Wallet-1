
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from './config';
import type { User } from 'firebase/auth';

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
  const userProfile = {
    email: user.email,
    createdAt: new Date(),
    walletAddress: generateWalletAddress(),
  };
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
