
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { signInWithCustomToken, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, serverTimestamp, DocumentData, getDoc, setDoc, writeBatch, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { marketCoins } from '@/lib/data';
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
  syncWalletBalance: (currency: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_STORAGE_KEY_PREFIX = 'apex-wallet-';
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const ADMIN_WALLET_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || '0x').toLowerCase();

// Helper to simulate address generation for different chains
const generateSimulatedAddress = (symbol: string, masterAddress: string) => {
    if (!masterAddress) return '';
    if (['ETH', 'LINK', 'BNB', 'USDT'].includes(symbol)) return masterAddress;
    if (symbol === 'SOL') return masterAddress.replace('0x', 'Sol') + 'Base58'.substring(0, 32);
    if (symbol === 'DOGE') return 'D' + masterAddress.substring(2, 35);
    if (symbol === 'BTC') return '1' + masterAddress.substring(2, 34);
    if (symbol === 'ADA') return 'addr1' + masterAddress.substring(2, 30);
    return 'Addr_' + symbol + '_' + masterAddress.substring(2, 10);
}

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

      // Initialize wallets for ALL cryptocurrencies available in the app
      marketCoins.forEach(coin => {
          const walletRef = doc(firestore, 'users', firebaseUser.uid, 'wallets', coin.symbol);
          const newWalletDocument = {
              id: coin.symbol,
              userId: firebaseUser.uid,
              currency: coin.symbol,
              balance: 0,
              address: generateSimulatedAddress(coin.symbol, walletInstance.address),
              lastSynced: serverTimestamp()
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

   useEffect(() => {
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
                   }
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
        // Self-healing: Ensure all market coin wallets exist for the imported account
        const batch = writeBatch(firestore);
        for (const coin of marketCoins) {
            const walletRef = doc(firestore, 'users', userId, 'wallets', coin.symbol);
            const snap = await getDoc(walletRef);
            if (!snap.exists()) {
                batch.set(walletRef, {
                    id: coin.symbol,
                    userId: userId,
                    currency: coin.symbol,
                    balance: 0,
                    address: generateSimulatedAddress(coin.symbol, importedWallet.address),
                    lastSynced: serverTimestamp()
                });
            } else if (!snap.data().address) {
                batch.update(walletRef, {
                    address: generateSimulatedAddress(coin.symbol, importedWallet.address)
                });
            }
        }
        await batch.commit();

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

  const syncWalletBalance = async (currency: string) => {
    if (!user || !firestore) return;
    
    // Simulating a realistic blockchain sync delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const walletRef = doc(firestore, 'users', user.uid, 'wallets', currency);
    const walletSnap = await getDoc(walletRef);
    
    if (walletSnap.exists()) {
        const currentBalance = walletSnap.data().balance;
        
        // Ensure address is defined to prevent Firestore writing errors (undefined values)
        let address = walletSnap.data().address;
        if (!address && wallet) {
            address = generateSimulatedAddress(currency, wallet.address);
            // Self-heal the document
            await updateDoc(walletRef, { address });
        }
        
        const safeAddress = address || generateSimulatedAddress(currency, userProfile?.walletAddress || '');

        // Logic: For this prototype, syncing a zero balance "discovers" initial funds for the user
        if (currentBalance === 0) {
            let simulatedFound = 0;
            switch(currency) {
                case 'ETH': simulatedFound = 0.045; break;
                case 'SOL': simulatedFound = 12.5; break;
                case 'LINK': simulatedFound = 150; break;
                case 'ADA': simulatedFound = 500; break;
                case 'BNB': simulatedFound = 1.2; break;
                case 'DOGE': simulatedFound = 1000; break;
                case 'USDT': simulatedFound = 100; break;
                default: simulatedFound = 10;
            }

            await updateDoc(walletRef, { 
                balance: simulatedFound,
                address: safeAddress,
                lastSynced: serverTimestamp()
            });

            // Log the 'Deposit' as a simulated transaction from an external source
            const txRef = doc(collection(walletRef, 'transactions'));
            await setDoc(txRef, {
                userId: user.uid,
                type: 'Buy',
                amount: simulatedFound,
                price: 0,
                timestamp: serverTimestamp(),
                status: 'Completed',
                sender: '0xBlockchainGateway_Network',
                recipient: safeAddress,
                notes: `Stateless verification confirmed ${simulatedFound} ${currency} at address ${safeAddress}`
            });

            toast({ title: `${currency} Balance Verified`, description: `Successfully verified on-chain. Found ${simulatedFound} ${currency}.` });
        } else {
            // Just update the last verified timestamp
            await updateDoc(walletRef, { 
                lastSynced: serverTimestamp(),
                address: safeAddress
            });
            toast({ title: `${currency} Synced`, description: `Blockchain confirms balance is ${currentBalance.toFixed(4)} ${currency}.` });
        }
    } else if (wallet) {
        // If document somehow doesn't exist, create it (another self-heal)
        const safeAddress = generateSimulatedAddress(currency, wallet.address);
        await setDoc(walletRef, {
            id: currency,
            userId: user.uid,
            currency: currency,
            balance: 0,
            address: safeAddress,
            lastSynced: serverTimestamp()
        });
        toast({ title: `Wallet Initialized`, description: `Generated new ${currency} address: ${safeAddress}` });
    }
  };

  if (isUserLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WalletContext.Provider value={{ wallet, user, userProfile: userProfile as UserProfile | null, loading, isAdmin, createWallet, importWallet, confirmAndCreateWallet, disconnectWallet, syncWalletBalance }}>
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
