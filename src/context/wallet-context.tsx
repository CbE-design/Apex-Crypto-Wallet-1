
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { signOut, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface Wallet {
  address: string;
  privateKey: string;
}

interface WalletContextType {
  wallet: Wallet | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  createWallet: () => string;
  importWallet: (mnemonic: string) => void;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_STORAGE_KEY_PREFIX = 'apex-wallet-';

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const loading = isUserLoading || isInitializing;

  const setWalletAndAdmin = useCallback((walletData: Wallet | null, firebaseUser: User | null) => {
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

  const setupWalletForUser = useCallback((firebaseUser: User, walletInstance: ethers.Wallet) => {
      const walletData = {
        address: walletInstance.address,
        privateKey: walletInstance.privateKey,
      };
      setWalletAndAdmin(walletData, firebaseUser);

      // Create user profile in Firestore if it doesn't exist
      if (firestore) {
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        const newUserDocument = {
          id: firebaseUser.uid,
          email: firebaseUser.email || `${walletInstance.address.substring(0, 8)}@apex.crypto`, // Placeholder
          createdAt: serverTimestamp(),
          walletAddress: walletInstance.address,
        };
        setDocumentNonBlocking(userRef, newUserDocument, { merge: true });
      }
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
          // If stored wallet is corrupt, sign out to force a fresh start
          if(auth) signOut(auth);
        }
      }
      // If no stored wallet, user is in a weird state.
      // Let them stay logged in to Firebase, but they will need to import/create.
    } else if (!user) { // No Firebase user
        setWalletAndAdmin(null, null);
    }
    setIsInitializing(false);
  }, [user, auth, wallet, setWalletAndAdmin]);


  const createWallet = useCallback((): string => {
    if (auth) {
      const newWallet = ethers.Wallet.createRandom();
      const mnemonic = newWallet.mnemonic?.phrase;
      if (!mnemonic) {
        throw new Error("Failed to generate mnemonic");
      }
      
      initiateAnonymousSignIn(auth)
        .then(userCredential => {
            if (userCredential?.user) {
                setupWalletForUser(userCredential.user, newWallet);
            }
        });

      return mnemonic;
    }
    throw new Error("Auth service not available");
  }, [auth, setupWalletForUser]);

  const importWallet = useCallback((mnemonic: string) => {
     if (auth) {
        try {
            const newWallet = ethers.Wallet.fromPhrase(mnemonic);
            initiateAnonymousSignIn(auth)
                .then(userCredential => {
                    if (userCredential?.user) {
                        setupWalletForUser(userCredential.user, newWallet);
                    }
                });
        } catch (e) {
            console.error("Invalid mnemonic phrase:", e);
            throw new Error("Invalid seed phrase. Please check and try again.");
        }
    } else {
         throw new Error("Auth service not available");
    }
  }, [auth, setupWalletForUser]);

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
    <WalletContext.Provider value={{ wallet, user, loading, isAdmin, createWallet, importWallet, disconnectWallet }}>
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
