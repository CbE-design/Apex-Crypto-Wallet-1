
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, serverTimestamp, writeBatch, collection, query, where, getDocs, limit, updateDoc, setDoc } from 'firebase/firestore';
import { marketCoins } from '@/lib/data';
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
// Standard address for 'abandon abandon ... about' mnemonic
const ADMIN_WALLET_ADDRESS = '0x985864190c7E5c803B918B273f324220037e819f'.toLowerCase();

const deriveIdentityAddress = (symbol: string, ethAddress: string) => {
    if (!ethAddress) return '';
    if (['ETH', 'LINK', 'BNB', 'USDT'].includes(symbol)) return ethAddress;
    if (symbol === 'SOL') return ethAddress.replace('0x', 'Sol') + 'Identity'.substring(0, 16);
    if (symbol === 'ADA') return 'addr1' + ethAddress.substring(2, 42);
    if (symbol === 'BTC') return '1' + ethAddress.substring(2, 35);
    return 'Identity_' + symbol + '_' + ethAddress.substring(2, 12);
}

export const generateTxHash = () => {
    return '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
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
        email: firebaseUser.email || `${walletInstance.address.substring(0, 8)}@apex.io`,
        createdAt: serverTimestamp(),
        walletAddress: walletInstance.address,
      };
      
      batch.set(userRef, newUserDocument, { merge: true });

      marketCoins.forEach(coin => {
          const walletRef = doc(firestore, 'users', firebaseUser.uid, 'wallets', coin.symbol);
          batch.set(walletRef, {
              id: coin.symbol,
              userId: firebaseUser.uid,
              currency: coin.symbol,
              balance: 0,
              address: deriveIdentityAddress(coin.symbol, walletInstance.address),
              lastSynced: serverTimestamp()
          }, { merge: true });
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

    async function initializeWallet() {
        if (user && !wallet) {
            const storedWalletJson = localStorage.getItem(`${WALLET_STORAGE_KEY_PREFIX}${user.uid}`);
            if (storedWalletJson) {
                try {
                    const storedWallet = JSON.parse(storedWalletJson);
                    if (storedWallet.privateKey) {
                        const walletInstance = new ethers.Wallet(storedWallet.privateKey);
                        setWalletAndAdmin({ address: walletInstance.address, privateKey: walletInstance.privateKey }, user);
                    }
                } catch (e) {
                    console.error("Wallet cache invalid.", e);
                    if (auth) signOut(auth);
                }
            }
        }
        setIsInitializing(false);
    }
    initializeWallet();
  }, [user, auth, wallet, setWalletAndAdmin]);

  const createWallet = useCallback(async (): Promise<string> => {
    const newWallet = ethers.Wallet.createRandom();
    return newWallet.mnemonic?.phrase || '';
  }, []);

  const confirmAndCreateWallet = useCallback(async (mnemonic: string) => {
    if (!auth) throw new Error("Auth missing");
    setIsInitializing(true);
    try {
        const newWallet = ethers.Wallet.fromPhrase(mnemonic);
        const userCredential = await initiateAnonymousSignIn(auth);
        if (userCredential?.user) {
          await setupUserAndWalletDocuments(userCredential.user, newWallet as any);
        }
    } catch (e) {
        console.error("Setup error:", e);
        throw e;
    } finally {
        setIsInitializing(false);
    }
  }, [auth, setupUserAndWalletDocuments]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!auth || !firestore) throw new Error("Services missing");
    setIsInitializing(true);
    try {
      // Validate and derive wallet
      const cleanMnemonic = mnemonic.trim().toLowerCase();
      const importedWallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      
      // Sign in anonymously to get a session
      const userCredential = await initiateAnonymousSignIn(auth);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // Check if user profile already exists for this UID
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        const userSnap = await getDocs(query(collection(firestore, 'users'), where("walletAddress", "==", importedWallet.address), limit(1)));
        
        if (userSnap.empty) {
            // First time this wallet is seen, set up new docs for this UID
            await setupUserAndWalletDocuments(firebaseUser, importedWallet as any);
        } else {
            // Wallet already exists in ledger, link this anonymous session to it
            // For the prototype, we just update the current session's profile to point to this address
            await setDoc(userRef, {
                id: firebaseUser.uid,
                email: firebaseUser.email || `${importedWallet.address.substring(0, 8)}@apex.io`,
                createdAt: serverTimestamp(),
                walletAddress: importedWallet.address,
            }, { merge: true });

            // Ensure sub-wallets exist
            const batch = writeBatch(firestore);
            marketCoins.forEach(coin => {
                const walletRef = doc(firestore, 'users', firebaseUser.uid, 'wallets', coin.symbol);
                batch.set(walletRef, {
                    id: coin.symbol,
                    userId: firebaseUser.uid,
                    currency: coin.symbol,
                    address: deriveIdentityAddress(coin.symbol, importedWallet.address),
                }, { merge: true });
            });
            await batch.commit();

            const walletData = {
                address: importedWallet.address,
                privateKey: importedWallet.privateKey,
            };
            setWalletAndAdmin(walletData, firebaseUser);
        }
      }
      router.push('/');
    } catch (e: any) {
      console.error("Import Error:", e);
      throw new Error("Invalid seed phrase or login failed.");
    } finally {
        setIsInitializing(false);
    }
  }, [auth, firestore, setWalletAndAdmin, router, setupUserAndWalletDocuments]);

  const disconnectWallet = useCallback(() => {
    if (auth) {
      const uid = auth.currentUser?.uid;
      signOut(auth).then(() => {
         if (uid) localStorage.removeItem(`${WALLET_STORAGE_KEY_PREFIX}${uid}`);
         setWallet(null);
         router.push('/login');
      });
    }
  }, [auth, router]);

  const syncWalletBalance = async (currency: string) => {
    if (!user || !firestore) return;
    const walletRef = doc(firestore, 'users', user.uid, 'wallets', currency);
    await updateDoc(walletRef, { lastSynced: serverTimestamp() });
  };

  if (isUserLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-background">
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
  if (context === undefined) throw new Error('useWallet missing');
  return context;
};
