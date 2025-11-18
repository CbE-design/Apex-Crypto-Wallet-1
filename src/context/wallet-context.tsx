
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
import { useRouter } from 'next/navigation';

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
const ADMIN_WALLET_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || '0x').toLowerCase();

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
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
      const isAdminUser = walletData.address.toLowerCase() === ADMIN_WALLET_ADDRESS;
      setIsAdmin(isAdminUser);
      return isAdminUser;
    } else {
      if (firebaseUser?.uid) {
        localStorage.removeItem(`${WALLET_STORAGE_KEY_PREFIX}${firebaseUser.uid}`);
      }
      setIsAdmin(false);
      return false;
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
    if (typeof window === 'undefined') {
        setIsInitializing(false);
        return;
    }

    let active = true;

    async function initializeWallet() {
        if (user && !wallet) {
            const storedWalletJson = localStorage.getItem(`${WALLET_STORAGE_KEY_PREFIX}${user.uid}`);
            if (storedWalletJson) {
                try {
                    const storedWallet = JSON.parse(storedWalletJson);
                    if (storedWallet.privateKey) {
                        const walletInstance = new ethers.Wallet(storedWallet.privateKey);
                        if(active) {
                            setWalletAndAdmin({ address: walletInstance.address, privateKey: walletInstance.privateKey }, user);
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse stored wallet.", e);
                    if (auth) signOut(auth);
                }
            }
        } else if (!user) {
            if(active) setWalletAndAdmin(null, null);
        }
        if(active) setIsInitializing(false);
    }
    
    initializeWallet();

    return () => { active = false; }
  }, [user, auth, wallet, setWalletAndAdmin]);

   // Handles requesting notification permission and saving FCM token
   useEffect(() => {
    // This entire effect should only run on the client.
    if (typeof window === 'undefined' || loading || !user || !firestore) {
        return;
    }

    const requestPermissionAndGetToken = async () => {
       if ('Notification' in window && 'serviceWorker' in navigator && VAPID_KEY) {
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
    
    requestPermissionAndGetToken();

    try {
        const messaging = getMessaging();
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground message received.', payload);
            toast({
                title: payload.notification?.title,
                description: payload.notification?.body,
            });
        });
        return () => unsubscribe();
    } catch (error) {
        console.error('Firebase Messaging not available in this context.', error);
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
    
    setIsInitializing(true);
    const newWallet = ethers.Wallet.fromPhrase(mnemonic);
    const userCredential = await initiateAnonymousSignIn(auth);
    
    if (userCredential?.user) {
      await setupUserAndWalletDocuments(userCredential.user, newWallet);
    } else {
      throw new Error("Failed to sign in anonymously.");
    }
    setIsInitializing(false);
  }, [auth, setupUserAndWalletDocuments]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!auth || !firestore) {
      throw new Error("Auth or Firestore service not available");
    }
    
    setIsInitializing(true);
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

      const userCredential = await initiateAnonymousSignIn(auth, userId);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        const walletData = {
          address: importedWallet.address,
          privateKey: importedWallet.privateKey,
        };
        const isAdminUser = setWalletAndAdmin(walletData, firebaseUser);
        
        toast({ title: 'Wallet Imported!', description: 'You have successfully logged in.' });
        if(isAdminUser) {
            router.push('/admin');
        } else {
            router.push('/');
        }

      } else {
        throw new Error("Failed to authenticate user.");
      }

    } catch (e: any) {
      console.error("Error importing wallet:", e);
      if (e.message.includes('invalid mnemonic')) {
          throw new Error("Invalid seed phrase. Please check and try again.");
      }
      throw e;
    } finally {
        setIsInitializing(false);
    }
  }, [auth, firestore, setWalletAndAdmin, toast, router]);


  const disconnectWallet = useCallback(() => {
    if (auth) {
      const uid = auth.currentUser?.uid;
      signOut(auth).then(() => {
         if (uid) {
            localStorage.removeItem(`${WALLET_STORAGE_KEY_PREFIX}${uid}`);
         }
         setWallet(null);
         setIsAdmin(false);
         router.push('/login');
      });
    }
  }, [auth, router]);

  if (isUserLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
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

    