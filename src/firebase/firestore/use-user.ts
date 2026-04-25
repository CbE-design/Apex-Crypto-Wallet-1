'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';

export interface UseUserResult {
  user: User | null;
  isUserLoading: boolean;
  error: Error | null;
}

export function useUser(): UseUserResult {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(auth.currentUser === null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setIsUserLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setIsUserLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setIsUserLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  return { user, isUserLoading, error };
}
