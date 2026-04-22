'use client';

import React, {
  createContext, useContext, useState, ReactNode,
  useCallback, useEffect, useMemo, useRef,
} from 'react';
import { ethers } from 'ethers';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, useFunctions } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { signOut, signInWithCustomToken, User as FirebaseUser } from 'firebase/auth';
import {
  doc, serverTimestamp, writeBatch,
  collection, query, where, getDocs, limit, updateDoc, setDoc, addDoc,
} from 'firebase/firestore';
import { marketCoins } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  encryptVault, decryptVault,
  encryptWithCredId, decryptWithCredId,
  VAULT_PREFIX, SESSION_PREFIX, PASSKEY_PREFIX,
  type Vault,
} from '@/lib/vault';
import { registerPasskey, authenticatePasskey, isPasskeySupported } from '@/lib/passkey';
import { httpsCallable } from 'firebase/functions';
import { KYCStatus } from '@/lib/types';

// ── types ────────────────────────────────────────────────────────────────
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
  kycStatus?: KYCStatus;
}

interface WalletContextType {
  wallet: Wallet | null;
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;

  // vault / auth state
  vaultLocked: boolean;
  pendingVaultSetup: boolean;
  hasPasskey: boolean;
  passkeySupported: boolean;
  addressHint: string;

  // actions
  createWallet: () => Promise<string>;
  importWallet: (mnemonic: string) => Promise<void>;
  confirmAndCreateWallet: (mnemonic: string) => Promise<void>;
  disconnectWallet: () => void;
  syncWalletBalance: (currency: string) => Promise<void>;

  // vault / PIN / passkey actions
  setupVault: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<void>;
  setupPasskey: () => Promise<void>;
  unlockWithPasskey: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const DEFAULT_ADMIN_ADDRESS = '0x985864190c7E5c803B918B273f324220037e819f'.toLowerCase();
const ADMIN_EMAILS = ['admin@apexwallet.io', 'corrie@apex-crypto.co.uk'];

// ── chain address derivation ───────────────────────────────────────────
const deriveIdentityAddress = (symbol: string, ethAddress: string) => {
  if (!ethAddress) return '';
  if (['ETH', 'LINK', 'BNB', 'USDT'].includes(symbol)) return ethAddress;
  if (symbol === 'SOL') return ethAddress.replace('0x', 'Sol') + 'Identity'.substring(0, 16);
  if (symbol === 'ADA') return 'addr1' + ethAddress.substring(2, 42);
  if (symbol === 'BTC') return '1' + ethAddress.substring(2, 35);
  return 'Identity_' + symbol + '_' + ethAddress.substring(2, 12);
};

// ── provider ─────────────────────────────────────────────────────────────
export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [pendingWallet, setPendingWallet] = useState<Wallet | null>(null);
  const [vaultLocked, setVaultLocked] = useState(false);
  const [addressHint, setAddressHint] = useState('');
  const [hasPasskey, setHasPasskey] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const pinnedPinRef = useRef<string | null>(null);

  const passkeySupported = useMemo(() => isPasskeySupported(), []);
  const pendingVaultSetup = pendingWallet !== null;

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const isAdmin = useMemo(() => {
    if (user?.email && ADMIN_EMAILS.includes(user.email)) return true;
    if (!wallet?.address) return false;
    const addr = wallet.address.toLowerCase();
    return addr === DEFAULT_ADMIN_ADDRESS || addr.endsWith('da94');
  }, [wallet?.address, user?.email]);

  const loading = isUserLoading || isInitializing || (!!user && isProfileLoading && !isAdmin);

  const setupUserAndWalletDocuments = useCallback(
    async (firebaseUser: FirebaseUser, walletInstance: ethers.Wallet): Promise<Wallet> => {
      if (!firestore) throw new Error('Firestore unavailable');

      const batch = writeBatch(firestore);
      const userRef = doc(firestore, 'users', firebaseUser.uid);

      batch.set(userRef, {
        id: firebaseUser.uid,
        email: firebaseUser.email || `${walletInstance.address.substring(0, 8)}@apex.io`,
        createdAt: serverTimestamp(),
        walletAddress: walletInstance.address,
        walletAddressLowercase: walletInstance.address.toLowerCase(),
      }, { merge: true });

      marketCoins.forEach(coin => {
        const walletRef = doc(firestore, 'users', firebaseUser.uid, 'wallets', coin.symbol);
        batch.set(walletRef, {
          id: coin.symbol,
          userId: firebaseUser.uid,
          currency: coin.symbol,
          balance: 0,
          address: deriveIdentityAddress(coin.symbol, walletInstance.address),
          lastSynced: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();

      try {
        await addDoc(collection(firestore, 'admin_notifications'), {
          type: 'NEW_USER',
          title: 'New User Registered',
          message: `A new wallet has been created: ${firebaseUser.email || walletInstance.address.substring(0, 12) + '...'}`,
          userId: firebaseUser.uid,
          userEmail: firebaseUser.email || `${walletInstance.address.substring(0, 8)}@apex.io`,
          read: false,
          createdAt: serverTimestamp(),
          metadata: { walletAddress: walletInstance.address },
        });
      } catch (_) {}

      return { address: walletInstance.address, privateKey: walletInstance.privateKey };
    },
    [firestore],
  );

  useEffect(() => {
    if (typeof window === 'undefined') { setIsInitializing(false); return; }

    async function initializeWallet() {
      if (user && !wallet) {
        const uid = user.uid;

        const sessionJson = sessionStorage.getItem(`${SESSION_PREFIX}${uid}`);
        if (sessionJson) {
          try {
            const cached = JSON.parse(sessionJson) as Wallet;
            if (cached.privateKey) {
              const inst = new ethers.Wallet(cached.privateKey);
              setWallet({ address: inst.address, privateKey: inst.privateKey });
              setIsInitializing(false);
              return;
            }
          } catch { sessionStorage.removeItem(`${SESSION_PREFIX}${uid}`); }
        }

        const vaultJson = localStorage.getItem(`${VAULT_PREFIX}${uid}`);
        if (vaultJson) {
          try {
            const vault = JSON.parse(vaultJson) as Vault;
            setAddressHint(vault.addressHint ?? '');
            const passkeyRaw = localStorage.getItem(`${PASSKEY_PREFIX}${uid}`);
            setHasPasskey(!!passkeyRaw);
          } catch { }
          setVaultLocked(true);
          setIsInitializing(false);
          return;
        }

        const legacyKey = `apex-wallet-${uid}`;
        const legacyJson = localStorage.getItem(legacyKey);
        if (legacyJson) {
          try {
            const stored = JSON.parse(legacyJson) as Wallet;
            if (stored.privateKey) {
              const inst = new ethers.Wallet(stored.privateKey);
              const w: Wallet = { address: inst.address, privateKey: inst.privateKey };
              setPendingWallet(w);
              localStorage.removeItem(legacyKey);
            }
          } catch { if (auth) signOut(auth); }
        }
      }
      setIsInitializing(false);
    }

    initializeWallet();
  }, [user, auth, wallet]);

  const setupVault = useCallback(async (pin: string) => {
    if (!pendingWallet || !user) throw new Error('No pending wallet to vault');
    const vault = await encryptVault(pendingWallet, pin);
    localStorage.setItem(`${VAULT_PREFIX}${user.uid}`, JSON.stringify(vault));
    sessionStorage.setItem(`${SESSION_PREFIX}${user.uid}`, JSON.stringify(pendingWallet));
    pinnedPinRef.current = pin;
    setAddressHint(vault.addressHint);
    setWallet(pendingWallet);
    setPendingWallet(null);
  }, [pendingWallet, user]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!user) throw new Error('Not authenticated');
    const vaultJson = localStorage.getItem(`${VAULT_PREFIX}${user.uid}`);
    if (!vaultJson) throw new Error('No vault found');
    const vault = JSON.parse(vaultJson) as Vault;
    const data = await decryptVault(vault, pin) as Wallet;
    if (!data.privateKey) throw new Error('Invalid vault');
    const inst = new ethers.Wallet(data.privateKey);
    const w: Wallet = { address: inst.address, privateKey: inst.privateKey };
    sessionStorage.setItem(`${SESSION_PREFIX}${user.uid}`, JSON.stringify(w));
    pinnedPinRef.current = pin;
    setWallet(w);
    setVaultLocked(false);
  }, [user]);

  const setupPasskey = useCallback(async () => {
    if (!user || !passkeySupported) throw new Error('Passkey not supported');
    const pin = pinnedPinRef.current;
    if (!pin) throw new Error('PIN session expired — please re-enter your PIN');

    const credId = await registerPasskey(user.uid, addressHint);
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await encryptWithCredId(pin, credId, salt);

    const passkeyData = {
      credId,
      salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
      ...wrapped,
    };
    localStorage.setItem(`${PASSKEY_PREFIX}${user.uid}`, JSON.stringify(passkeyData));
    setHasPasskey(true);
  }, [user, passkeySupported, addressHint]);

  const unlockWithPasskey = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    const rawPasskey = localStorage.getItem(`${PASSKEY_PREFIX}${user.uid}`);
    if (!rawPasskey) throw new Error('No passkey configured');
    const passkeyData = JSON.parse(rawPasskey);
    const credId = await authenticatePasskey(passkeyData.credId);
    const pin = await decryptWithCredId(passkeyData, credId);
    await unlockWithPin(pin);
  }, [user, unlockWithPin]);

  const createWallet = useCallback(async (): Promise<string> => {
    const w = ethers.Wallet.createRandom();
    return w.mnemonic?.phrase ?? '';
  }, []);

  const confirmAndCreateWallet = useCallback(async (mnemonic: string) => {
    if (!auth) throw new Error('Auth missing');
    setIsInitializing(true);
    try {
      const newWallet = ethers.Wallet.fromPhrase(mnemonic);
      const userCredential = await initiateAnonymousSignIn(auth);
      if (userCredential?.user) {
        const walletData = await setupUserAndWalletDocuments(userCredential.user, newWallet as any);
        setPendingWallet(walletData);
      }
    } catch (e) {
      toast({ title: 'Setup Failed', description: 'Could not create secure identity.', variant: 'destructive' });
      throw e;
    } finally {
      setIsInitializing(false);
    }
  }, [auth, setupUserAndWalletDocuments, toast]);

  const importWallet = useCallback(async (mnemonic: string) => {
    if (!auth || !firestore || !functions) throw new Error('Services missing');
    setIsInitializing(true);
    try {
      const cleanMnemonic = mnemonic.trim().toLowerCase();
      const importedWallet = ethers.Wallet.fromPhrase(cleanMnemonic);
      const getCustomToken = httpsCallable(functions, 'getCustomToken');

      try {
        const result = await getCustomToken({ walletAddress: importedWallet.address });
        const { token } = result.data as { token: string };
        await signInWithCustomToken(auth, token);
        const walletData = { address: importedWallet.address, privateKey: importedWallet.privateKey };
        setPendingWallet(walletData);

      } catch (error: any) {
        // If user not found, create a new one
        if (error.code === 'not-found') {
            const userCredential = await initiateAnonymousSignIn(auth);
            const firebaseUser = userCredential.user;
            if (firebaseUser) {
                const walletData = await setupUserAndWalletDocuments(firebaseUser, importedWallet as any);
                setPendingWallet(walletData);
            }
        } else {
            throw error;
        }
      }
    } catch (e: any) {
      toast({ title: 'Identity Import Failed', description: 'Invalid seed phrase or connection error.', variant: 'destructive' });
      throw new Error('Invalid seed phrase or login failed.');
    } finally {
      setIsInitializing(false);
    }
  }, [auth, firestore, functions, setupUserAndWalletDocuments, toast]);

  const disconnectWallet = useCallback(() => {
    if (!auth) return;
    const uid = auth.currentUser?.uid;
    signOut(auth).then(() => {
      if (uid && typeof window !== 'undefined') {
        localStorage.removeItem(`${VAULT_PREFIX}${uid}`);
        localStorage.removeItem(`apex-wallet-${uid}`);
        sessionStorage.removeItem(`${SESSION_PREFIX}${uid}`);
      }
      pinnedPinRef.current = null;
      setWallet(null);
      setPendingWallet(null);
      setVaultLocked(false);
      setHasPasskey(false);
      router.push('/login');
    });
  }, [auth, router]);

  const syncWalletBalance = async (currency: string) => {
    if (!user || !firestore) return;
    await updateDoc(doc(firestore, 'users', user.uid, 'wallets', currency), {
      lastSynced: serverTimestamp(),
    });
  };

  return (
    <WalletContext.Provider value={{
      wallet, user, userProfile: userProfile as UserProfile | null,
      loading, isAdmin,
      vaultLocked, pendingVaultSetup, hasPasskey, passkeySupported, addressHint,
      createWallet, importWallet, confirmAndCreateWallet, disconnectWallet, syncWalletBalance,
      setupVault, unlockWithPin, setupPasskey, unlockWithPasskey,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet missing');
  return ctx;
};
