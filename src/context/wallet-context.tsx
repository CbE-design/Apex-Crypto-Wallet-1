
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';
import { useUser, useAuth } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { signOut, User } from 'firebase/auth';

interface Wallet {
  address: string;
  privateKey: string;
}

interface WalletContextType {
  wallet: Wallet | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_STORAGE_KEY_PREFIX = 'apex-wallet-';
const ADMIN_WALLET_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, isUserLoading, userError } = useUser();
  const auth = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loading = isUserLoading || (user != null && wallet == null);

  const setWalletAndAdmin = useCallback((walletData: Wallet | null) => {
    setWallet(walletData);
    if (walletData) {
        if (user?.uid) {
            localStorage.setItem(`${WALLET_STORAGE_KEY_PREFIX}${user.uid}`, JSON.stringify(walletData));
        }
      
        if (ADMIN_WALLET_ADDRESS && typeof walletData.address === 'string') {
            setIsAdmin(walletData.address.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase());
        } else {
            setIsAdmin(false);
        }

    } else {
      if(user?.uid) {
        localStorage.removeItem(`${WALLET_STORAGE_KEY_PREFIX}${user.uid}`);
      }
      setIsAdmin(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user && !wallet) {
      const storedWallet = localStorage.getItem(`${WALLET_STORAGE_KEY_PREFIX}${user.uid}`);
      if (storedWallet) {
        try {
          const walletData = JSON.parse(storedWallet);
          if (walletData.address && walletData.privateKey) {
            setWalletAndAdmin(walletData);
          }
        } catch (e) {
            console.error("Failed to parse wallet, creating new one.", e);
            const newWallet = ethers.Wallet.createRandom();
            const walletData = {
                address: newWallet.address,
                privateKey: newWallet.privateKey,
            };
            setWalletAndAdmin(walletData);
        }
      } else {
        const newWallet = ethers.Wallet.createRandom();
        const walletData = {
            address: newWallet.address,
            privateKey: newWallet.privateKey,
        };
        setWalletAndAdmin(walletData);
      }
    } else if (!user) {
      setWallet(null);
      setIsAdmin(false);
    }
  }, [user, wallet, setWalletAndAdmin]);


  const connectWallet = useCallback(() => {
    initiateAnonymousSignIn(auth);
  }, [auth]);


  const disconnectWallet = useCallback(() => {
    signOut(auth);
    setWalletAndAdmin(null);
  }, [auth, setWalletAndAdmin]);

  if (loading && !user) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    )
  }

  return (
    <WalletContext.Provider value={{ wallet, user, loading, isAdmin, connectWallet, disconnectWallet }}>
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
