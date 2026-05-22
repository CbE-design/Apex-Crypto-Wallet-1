'use client';

import React, {
  createContext, useContext, useState, ReactNode,
  useCallback, useEffect, useMemo, useRef,
} from 'react';
import { ethers } from 'ethers';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut, signInWithCustomToken, User as FirebaseUser } from 'firebase/auth';
import {
  doc, serverTimestamp, writeBatch,
  collection, getDocs, updateDoc, setDoc,
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

  vaultLocked: boolean;
  pendingVaultSetup: boolean;
  hasPasskey: boolean;
  passkeySupported: boolean;
  addressHint: string;

  createWallet: () => Promise<string>;
  importWallet: (mnemonic: string) => Promise<void>;
  confirmAndCreateWallet: (mnemonic: string) => Promise<void>;
  disconnectWallet: () => void;
  syncWalletBalance: (currency: string) => Promise<void>;

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

// ── get a Firebase custom token from the server for a given wallet address ──
// This is the key function that ensures the same address always maps to the
// same Firebase UID, preserving all existing data across imports.
async function getCustomTokenForWallet(walletAddress: string): Promise<{ token: string; isReturningUser: boolean }> {
  const res = await fetch('/api/auth/wallet-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Could not establish secure session.');
  }
  return res.json();
}

// ── provider ─────────────────────────────────────────────────────────────
export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [pendingWallet, setPendingWallet] = useState<Wallet | null>(null);
  const [vaultLocked, setVaultLocked] = useState(false);
  const [addressHint, setAddressHint] = useState('');
  const [hasPasskey, setHasPasskey] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [passkeySupported, setPasskeySupported] = useState(false);

  const pinnedPinRef = useRef<string | null>(null);

  // Safety: Only check passkey support on client mount to avoid hydration mismatch
  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

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

  // ── clear all local storage for a given UID ───────────────────────────
  const clearLocalSession = useCallback((uid: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${VAULT_PREFIX}${uid}`);
    localStorage.removeItem(`${PASSKEY_PREFIX}${uid}`);
    localStorage.removeItem(`apex-wallet-${uid}`); // Legacy
    localStorage.removeItem(`${SESSION_PREFIX}${uid}`);
  }, []);

  // ── sign in with a custom token, clearing any prior session first ─────
  const signInWithToken = useCallback(async (token: string): Promise<FirebaseUser> => {
    if (!auth) throw new Error('Auth unavailable');
    const previousUid = auth.currentUser?.uid;
    if (auth.currentUser) {
      await signOut(auth);
    }
    if (previousUid) clearLocalSession(previousUid);
    const cred = await signInWithCustomToken(auth, token);
    return cred.user;
  }, [auth, clearLocalSession]);

  // ── create/update Firestore documents for a user+wallet ──────────────
  // Uses merge:true throughout so it is safe to call on returning users;
  // existing fields (kycStatus, balances, etc.) are never overwritten.
  const setupUserAndWalletDocuments = useCallback(
    async (firebaseUser: FirebaseUser, walletInstance: ethers.Wallet, isNew: boolean): Promise<Wallet> => {
      if (!firestore) throw new Error('Firestore unavailable');

      const batch = writeBatch(firestore);
      const userRef = doc(firestore, 'users', firebaseUser.uid);

      // Always merge so returning users keep their existing profile fields.
      const profileUpdate: Record<string, any> = {
        id: firebaseUser.uid,
        walletAddress: walletInstance.address,
        walletAddressLowercase: walletInstance.address.toLowerCase(),
      };
      if (isNew) {
        profileUpdate.email = `${walletInstance.address.substring(0, 8)}@apex.io`;
        profileUpdate.createdAt = serverTimestamp();
        profileUpdate.kycStatus = "NOT_SUBMITTED";
      }
      batch.set(userRef, profileUpdate, { merge: true });

      // Create wallet sub-documents with merge:true so existing balances survive.
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

      // Only fire the admin notification for genuinely new accounts.
      if (isNew) {
        try {
          const { addDoc } = await import('firebase/firestore');
          await addDoc(collection(firestore, 'admin_notifications'), {
            type: 'NEW_USER',
            title: 'New User Registered',
            message: `New wallet registered: ${walletInstance.address.substring(0, 12)}...`,
            userId: firebaseUser.uid,
            userEmail: `${walletInstance.address.substring(0, 8)}@apex.io`,
            read: false,
            createdAt: serverTimestamp(),
            metadata: { walletAddress: walletInstance.address },
          });
        } catch (_) {}
      }

      return { address: walletInstance.address, privateKey: walletInstance.privateKey };
    },
    [firestore],
  );

  // ── restore vault state from localStorage on mount ───────────────────
  useEffect(() => {
    if (typeof window === 'undefined') { setIsInitializing(false); return; }

    async function initializeWallet() {
      if (user && !wallet) {
        const uid = user.uid;

        // 1. Check local vault (locked) or legacy unlocked session data.
        const vaultJson = localStorage.getItem(`${VAULT_PREFIX}${uid}`);
        if (vaultJson) {
          try {
            const vault = JSON.parse(vaultJson) as Vault;
            setAddressHint(vault.addressHint ?? '');
            setHasPasskey(!!localStorage.getItem(`${PASSKEY_PREFIX}${uid}`));
          } catch { }
          setVaultLocked(true);
          setIsInitializing(false);
          return;
        }

        const sessionJson = localStorage.getItem(`${SESSION_PREFIX}${uid}`);
        if (sessionJson) {
          try {
            const cached = JSON.parse(sessionJson) as Wallet;
            if (cached.privateKey) {
              const inst = new ethers.Wallet(cached.privateKey);
              const w: Wallet = { address: inst.address, privateKey: inst.privateKey };
              setAddressHint(`${w.address.slice(0, 6)}...${w.address.slice(-4)}`);
              setWallet(w);
              setVaultLocked(true);
              setIsInitializing(false);
              return;
            }
          } catch { localStorage.removeItem(`${SESSION_PREFIX}${uid}`); }
        }

        // 2. Legacy key migration
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

  // ── vault / PIN / passkey ─────────────────────────────────────────────
  const setupVault = useCallback(async (pin: string) => {
    if (!pendingWallet || !user) throw new Error('No pending wallet to vault');
    const vault = await encryptVault(pendingWallet, pin);
    localStorage.setItem(`${VAULT_PREFIX}${user.uid}`, JSON.stringify(vault));
    localStorage.setItem(`${SESSION_PREFIX}${user.uid}`, JSON.stringify(pendingWallet));
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
    localStorage.setItem(`${SESSION_PREFIX}${user.uid}`, JSON.stringify(w));
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

  // ── create new wallet ─────────────────────────────────────────────────
  const createWallet = useCallback(async (): Promise<string> => {
    const w = ethers.Wallet.createRandom();
    return w.mnemonic?.phrase ?? '';
  }, []);

  // ── confirm new wallet creation ───────────────────────────────────────
  const confirmAndCreateWallet = useCallback(async (mnemonic: string) => {
    if (!auth) throw new Error('Auth missing');
    setIsInitializing(true);
    try {
      const newWallet = ethers.Wallet.fromPhrase(mnemonic);

      // Use the same custom-token flow as import so this new wallet gets a
      // deterministic UID — future imports of this seed will find the same account.
      const { token, isReturningUser } = await getCustomTokenForWallet(newWallet.address);
      const firebaseUser = await signInWithToken(token);
      const walletData = await setupUserAndWalletDocuments(firebaseUser, newWallet as any, !isReturningUser);
      setPendingWallet(walletData);
    } catch (e) {
      toast({ title: 'Setup Failed', description: 'Could not create secure identity.', variant: 'destructive' });
      throw e;
    } finally {
      setIsInitializing(false);
    }
  }, [auth, signInWithToken, setupUserAndWalletDocuments, toast]);

  // ── import existing wallet ────────────────────────────────────────────
  const importWallet = useCallback(async (mnemonic: string) => {
    if (!auth || !firestore) throw new Error('Services missing');
    setIsInitializing(true);
    try {
      // 1. Sanitise the mnemonic, as per replit.md notes
      const cleanMnemonic = mnemonic
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
        .replace(/[\"'`]/g, '')                 // remove quotes
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');                   // normalise whitespace

      // 2. Validate word count
      const wordCount = cleanMnemonic.split(' ').filter(Boolean).length;
      if (![12, 15, 18, 21, 24].includes(wordCount)) {
        throw new Error(`Seed phrases must be 12, 15, 18, 21, or 24 words. You entered ${wordCount}.`);
      }

      // 3. Validate the mnemonic and derive the wallet instance
      const importedWallet = ethers.Wallet.fromPhrase(cleanMnemonic);

      // 4. Ask the server for a custom auth token.
      // The server looks up the wallet address in Firestore and returns the
      // existing user's UID if one exists, so all their data is preserved.
      const { token, isReturningUser } = await getCustomTokenForWallet(importedWallet.address);

      // 5. Sign in as the correct UID (same one they've always had).
      const firebaseUser = await signInWithToken(token);

      // 6. Set up / update Firestore documents.
      // merge:true means existing balances, KYC status, etc. are never wiped.
      const walletData = await setupUserAndWalletDocuments(
        firebaseUser,
        importedWallet as any,
        !isReturningUser,
      );

      // 7. Set the wallet in a pending state to trigger the PIN setup flow.
      setPendingWallet(walletData);

    } catch (err: any) {
      console.error('[importWallet] failed:', err);
      const lower = (err?.message || '').toLowerCase();
      let msg: string;
      if (lower.includes('seed phrases must be')) {
        msg = err.message;
      } else if (
        lower.includes('mnemonic') ||
        lower.includes('phrase') ||
        lower.includes('checksum') ||
        lower.includes('wordlist')
      ) {
        msg = 'That seed phrase is not valid. Check the spelling, order, and word count.';
      } else if (lower.includes('firebase admin sdk')) {
        msg = 'The wallet service is temporarily unavailable. Please try again in a moment.';
      } else if (lower.includes('auth') || lower.includes('network') || lower.includes('fetch')) {
        msg = 'Could not reach the secure session service. Check your connection and try again.';
      } else if (lower.includes('permission')) {
        msg = 'Access was denied. Please refresh the page and try again.';
      } else {
        msg = err?.message || 'Could not restore wallet. Please try again.';
      }
      toast({ title: 'Restore Failed', description: msg, variant: 'destructive' });
      throw err; // Re-throw to allow the calling component to know about the failure
    } finally {
      setIsInitializing(false);
    }
  }, [auth, firestore, signInWithToken, setupUserAndWalletDocuments, toast]);


  // ── disconnect ────────────────────────────────────────────────────────
  const disconnectWallet = useCallback(() => {
    if (!auth) return;
    const uid = auth.currentUser?.uid;
    signOut(auth).then(() => {
      if (uid) clearLocalSession(uid);
      pinnedPinRef.current = null;
      setWallet(null);
      setPendingWallet(null);
      setVaultLocked(false);
      setHasPasskey(false);
      setAddressHint('');
      router.push('/login');
    });
  }, [auth, clearLocalSession, router]);

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
