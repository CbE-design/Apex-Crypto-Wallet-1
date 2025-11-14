
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { signInWithCustomToken, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, serverTimestamp, DocumentData, getDoc, setDoc, writeBatch, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { portfolioAssets } from '@/lib/data';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useToast } from '@/hooks/use-toast';

interface Wallet {
  address: string;
  privateKey: string;
}

interface UserProfile {
    id: string;
    email: string;
    createdAt: any;
    walletAddress: string;
    fcmToken?: string;
}

interface WalletContextType {
  wallet: Wallet | null;
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  createWallet: () => Promise<string>;
  importWallet: (mnemonic: string) => Promise<void>;
  confirmAndCreateWallet: (mnemonic: string) => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_STORAGE_KEY_PREFIX = 'apex-wallet-';
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const loading = isUserLoading || isInitializing || isProfileLoading;

  const setWalletAndAdmin = useCallback((walletData: Wallet | null, firebaseUser: FirebaseUser | null) => {
    setWallet(walletData);
    if (walletData && firebaseUser?.uid) {
      localStorage.setItem(`${WALLET_STORAGE_KEY_PREFIX}${firebaseUser.uid}`, JSON.stringify(walletData));
      const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || '0x';
      setIsAdmin(walletData.address.toLowerCase() === adminAddress.toLowerCase());
    } else {
      if (firebaseUser?.uid) {
        localStorage.removeItem(`${WALLET_STORAGE_KEY_PREFIX}${firebaseUser.uid}`);
      }
      setIsAdmin(false);
    }
  }, []);

  const setupUserAndWalletDocuments = useCallback(async (firebaseUser: FirebaseUser, walletInstance: ethers.Wallet) => {
      if (!firestore) throw new Error("Firestore is not available.");

      const batch = writeBatch(firestore);

      const userRef = doc(firestore, 'users', firebaseUser.uid);
      const newUserDocument: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email || `${walletInstance.address.substring(0, 8)}@apex.crypto`,
        createdAt: serverTimestamp(),
        walletAddress: walletInstance.address,
      };
      batch.set(userRef, newUserDocument, { merge: true });

      const initialAssets = [...portfolioAssets];
      if (!initialAssets.some(a => a.symbol === 'ETH')) {
        initialAssets.push({ symbol: 'ETH', name: 'Ethereum', amount: 0, valueUSD: 0, priceUSD: 0, change24h: 0, icon: 'Ethereum' });
      }

      initialAssets.forEach(asset => {
          const walletRef = doc(firestore, 'users', firebaseUser.uid, 'wallets', asset.symbol);
          const newWalletDocument = {
              id: asset.symbol,
              userId: firebaseUser.uid,
              currency: asset.symbol,
              balance: 0,
          };
          batch.set(walletRef, newWalletDocument, { merge: true });
      });

      await batch.commit();

      const walletData = {
        address: walletInstance.address,
        privateKey: walletInstance.privateKey,
      };
      setWalletAndAdmin(walletData, firebaseUser);

  }, [firestore, setWalletAndAdmin]);


  useEffect(() => {
    setIsInitializing(true);
    if (user && !wallet) { // User is logged in to Firebase, but wallet not in state
      const storedWalletJson = localStorage.getItem(`${WALLET_STORAGE_KEY_PREFIX}${user.uid}`);
      if (storedWalletJson) {
        try {
          const storedWallet = JSON.parse(storedWalletJson);
          if (storedWallet.privateKey) {
             const walletInstance = new ethers.Wallet(storedWallet.privateKey);
             setWalletAndAdmin(
                { address: walletInstance.address, privateKey: walletInstance.privateKey },
                user
             );
          }
        } catch (e) {
          console.error("Failed to parse stored wallet.", e);
          if(auth) signOut(auth);
        }
      }
    } else if (!user) {
        setWalletAndAdmin(null, null);
    }
    setIsInitializing(false);
  }, [user, auth, wallet, setWalletAndAdmin]);

   // Handles requesting notification permission and saving FCM token
   useEffect(() => {
    const requestPermissionAndGetToken = async () => {
       if ('Notification' in window && VAPID_KEY && user && firestore) {
           try {
               const permission = await Notification.requestPermission();
               if (permission === 'granted') {
                   const messaging = getMessaging();
                   const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
                   if (currentToken) {
                        const userRef = doc(firestore, 'users', user.uid);
                        const userDoc = await getDoc(userRef);
                        if (userDoc.exists() && userDoc.data()?.fcmToken !== currentToken) {
                            await updateDoc(userRef, { fcmToken: currentToken });
                        }
                   } else {
                       console.log('No registration token available. Request permission to generate one.');
                   }
               } else {
                   console.log('Unable to get permission to notify.');
               }
           } catch (err) {
               console.error('An error occurred while retrieving token or permission. ', err);
           }
       }
    };
    
    // Only run this logic after the user is fully loaded and logged in
    if (!loading && user && firestore) {
        requestPermissionAndGetToken();
    }

    // Set up foreground message handling
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const messaging = getMessaging();
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground message received.', payload);
            toast({
                title: payload.notification?.title,
                description: payload.notification?.body,
            });
        });
        return () => unsubscribe();
    }

  }, [user, firestore, loading, toast]);


  const createWallet = useCallback(async (): Promise<string> => {
    const newWallet = ethers.Wallet.createRandom();
    const mnemonic = newWallet.mnemonic?.phrase;
    if (!mnemonic) {
      throw new Error("Failed to generate mnemonic");
    }
    return mnemonic;
  }, []);

  const confirmAndCreateWallet = useCallback(async (mnemonic: string) => {
    if (!auth) throw new Error("Auth service not available");
    
    const newWallet = ethers.Wallet.fromPhrase(mnemonic);
    const userCredential = await initiateAnonymousSignIn(auth);
    
    if (userCredential?.user) {
      await setupUserAndWalletDocuments(userCredential.user, newWallet);
    } else {
      throw new Error("Failed to sign in anonymously.");
    }
  }, [auth, setupUserAndWalletDocuments]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!auth || !firestore) {
      throw new Error("Auth or Firestore service not available");
    }
    
    try {
      const sanitizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
      const importedWallet = ethers.Wallet.fromPhrase(sanitizedMnemonic);
      
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where("walletAddress", "==", importedWallet.address), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("No account found for this seed phrase.");
      }
      
      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;

      // We are signing in anonymously for simplicity. 
      // In a real app, you would have a more robust custom auth system.
      const userCredential = await initiateAnonymousSignIn(auth, userId);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        const walletData = {
          address: importedWallet.address,
          privateKey: importedWallet.privateKey,
        };
        setWalletAndAdmin(walletData, firebaseUser);
      } else {
        throw new Error("Failed to authenticate user.");
      }

    } catch (e: any) {
      console.error("Error importing wallet:", e);
      if (e.message.includes('invalid mnemonic')) {
          throw new Error("Invalid seed phrase. Please check and try again.");
      }
      throw e; // Re-throw other errors
    }
  }, [auth, firestore, setWalletAndAdmin]);


  const disconnectWallet = useCallback(() => {
    if (auth) {
      const uid = auth.currentUser?.uid;
      signOut(auth).then(() => {
         if (uid) {
            localStorage.removeItem(`${WALLET_STORAGE_KEY_PREFIX}${uid}`);
         }
         setWallet(null);
         setIsAdmin(false);
      });
    }
  }, [auth]);

  if (isUserLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WalletContext.Provider value={{ wallet, user, userProfile: userProfile as UserProfile | null, loading, isAdmin, createWallet, importWallet, confirmAndCreateWallet, disconnectWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
