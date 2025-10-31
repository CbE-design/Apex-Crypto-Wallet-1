
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';

interface Wallet {
  address: string;
  privateKey: string;
}

interface WalletContextType {
  wallet: Wallet | null;
  loading: boolean;
  isAdmin: boolean;
  createWallet: () => Promise<string>;
  importWallet: (mnemonic: string) => Promise<boolean>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_STORAGE_KEY = 'apex-wallet';

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const storedWallet = localStorage.getItem(WALLET_STORAGE_KEY);
      if (storedWallet) {
        const walletData = JSON.parse(storedWallet);
        if (walletData.address && walletData.privateKey) {
            setWallet(walletData);
            if (walletData.address === process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS) {
              setIsAdmin(true);
            }
        }
      }
    } catch (error) {
        console.error("Failed to parse wallet from localStorage", error);
        localStorage.removeItem(WALLET_STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  const setWalletAndAdmin = (walletData: Wallet | null) => {
    if (walletData) {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletData));
      setWallet(walletData);
      setIsAdmin(walletData.address === process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS);
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      setWallet(null);
      setIsAdmin(false);
    }
  }


  const createWallet = useCallback(async () => {
    setLoading(true);
    const newWallet = ethers.Wallet.createRandom();
    const walletData = {
      address: newWallet.address,
      privateKey: newWallet.privateKey,
    };
    setWalletAndAdmin(walletData);
    setLoading(false);
    return newWallet.mnemonic?.phrase ?? '';
  }, []);

  const importWallet = useCallback(async (mnemonic: string) => {
    setLoading(true);
    try {
      if (!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }
      const importedWallet = ethers.Wallet.fromPhrase(mnemonic);
      const walletData = {
        address: importedWallet.address,
        privateKey: importedWallet.privateKey,
      };
      setWalletAndAdmin(walletData);
      setLoading(false);
      return true;
    } catch (error) {
      console.error("Failed to import wallet:", error);
      setLoading(false);
      return false;
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletAndAdmin(null);
  }, []);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    )
  }

  return (
    <WalletContext.Provider value={{ wallet, loading, isAdmin, createWallet, importWallet, disconnectWallet }}>
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
