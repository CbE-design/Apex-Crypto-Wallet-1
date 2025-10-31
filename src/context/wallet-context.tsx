
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
const ADMIN_WALLET_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS;

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const setWalletAndAdmin = useCallback((walletData: Wallet | null) => {
    setWallet(walletData);
    if (walletData) {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletData));
      // Securely compare addresses in a case-insensitive manner
      const adminAddress = ADMIN_WALLET_ADDRESS;
      if (adminAddress && typeof adminAddress === 'string' && typeof walletData.address === 'string') {
        setIsAdmin(walletData.address.toLowerCase() === adminAddress.toLowerCase());
      } else {
        setIsAdmin(false);
      }
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    try {
      const storedWallet = localStorage.getItem(WALLET_STORAGE_KEY);
      if (storedWallet) {
        const walletData = JSON.parse(storedWallet);
        if (walletData.address && walletData.privateKey) {
            setWalletAndAdmin(walletData);
        }
      }
    } catch (error) {
        console.error("Failed to parse wallet from localStorage", error);
        localStorage.removeItem(WALLET_STORAGE_KEY);
    }
    setLoading(false);
  }, [setWalletAndAdmin]);


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
  }, [setWalletAndAdmin]);

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
  }, [setWalletAndAdmin]);

  const disconnectWallet = useCallback(() => {
    setWalletAndAdmin(null);
  }, [setWalletAndAdmin]);

  if (loading && !wallet) {
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
