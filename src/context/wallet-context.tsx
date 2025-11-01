
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { portfolioAssets } from '@/lib/data';

interface Wallet {
  address: string;
  privateKey: string;
}

interface UserProfile {
    id: string;
    email: string;
    createdAt: any;
    walletAddress: string;
    verificationStatus: 'Unverified' | 'Pending' | 'Verified';
}

interface WalletContextType {
  wallet: Wallet | null;
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  ethBalance: number;
  loading: boolean;
  isAdmin: boolean;
  createWallet: () => string;
  importWallet: (mnemonic: string) => void;
  disconnectWallet: () => void;
  requestVerification: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_STORAGE_KEY_PREFIX = 'apex-wallet-';

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ethBalance, setEthBalance] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

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

  const setupUserAndWalletDocuments = useCallback((firebaseUser: FirebaseUser, walletInstance: ethers.Wallet) => {
      const walletData = {
        address: walletInstance.address,
        privateKey: walletInstance.privateKey,
      };
      setWalletAndAdmin(walletData, firebaseUser);

      if (firestore) {
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        const newUserDocument: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || `${walletInstance.address.substring(0, 8)}@apex.crypto`,
          createdAt: serverTimestamp(),
          walletAddress: walletInstance.address,
          verificationStatus: 'Unverified',
        };
        setDocumentNonBlocking(userRef, newUserDocument, { merge: true });

        portfolioAssets.forEach(asset => {
            const walletRef = doc(firestore, 'users', firebaseUser.uid, 'wallets', asset.symbol);
            const newWalletDocument = {
                id: asset.symbol,
                userId: firebaseUser.uid,
                currency: asset.symbol,
                balance: 0,
            };
            setDocumentNonBlocking(walletRef, newWalletDocument, { merge: true });
        });
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
          if(auth) signOut(auth);
        }
      }
    } else if (!user) {
        setWalletAndAdmin(null, null);
    }
    setIsInitializing(false);
  }, [user, auth, wallet, setWalletAndAdmin]);

  useEffect(() => {
    if (wallet?.address && process.env.NEXT_PUBLIC_INFURA_PROJECT_ID) {
      const provider = new ethers.InfuraProvider("mainnet", process.env.NEXT_PUBLIC_INFURA_PROJECT_ID);
      provider.getBalance(wallet.address).then(balance => {
        setEthBalance(parseFloat(ethers.formatEther(balance)));
      });
    }
  }, [wallet?.address]);

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
                setupUserAndWalletDocuments(userCredential.user, newWallet);
            }
        });

      return mnemonic;
    }
    throw new Error("Auth service not available");
  }, [auth, setupUserAndWalletDocuments]);

  const importWallet = useCallback((mnemonic: string) => {
     if (auth) {
        try {
            const newWallet = ethers.Wallet.fromPhrase(mnemonic);
            initiateAnonymousSignIn(auth)
                .then(userCredential => {
                    if (userCredential?.user) {
                        setupUserAndWalletDocuments(userCredential.user, newWallet);
                    }
                });
        } catch (e) {
            console.error("Invalid mnemonic phrase:", e);
            throw new Error("Invalid seed phrase. Please check and try again.");
        }
    } else {
         throw new Error("Auth service not available");
    }
  }, [auth, setupUserAndWalletDocuments]);

  const disconnectWallet = useCallback(() => {
    if (auth) {
      const uid = auth.currentUser?.uid;
      signOut(auth).then(() => {
         if (uid) {
            localStorage.removeItem(`${WALLET_STORAGE_KEY_PREFIX}${uid}`);
         }
         setWallet(null);
         setIsAdmin(false);
         setEthBalance(0);
      });
    }
  }, [auth]);

  const requestVerification = useCallback(() => {
    if (userDocRef) {
      updateDocumentNonBlocking(userDocRef, { verificationStatus: 'Pending' });
    }
  }, [userDocRef]);

  if (isUserLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WalletContext.Provider value={{ wallet, user, userProfile: userProfile as UserProfile | null, ethBalance, loading, isAdmin, createWallet, importWallet, disconnectWallet, requestVerification }}>
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
