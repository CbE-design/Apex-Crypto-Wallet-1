'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidance. Also make sure that its dependencies are stable
 * references.
 */
export function useCollection<T = any>(
  memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & { __memo?: boolean }) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  // Only show loading spinner on the very first load (no data yet)
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Only set loading if we have no cached data yet (avoid flash on reconnect)
    setData(prev => {
      if (prev === null) setIsLoading(true);
      return prev;
    });
    setError(null);

    let unsubscribe: () => void;
    try {
      unsubscribe = onSnapshot(
        memoizedTargetRefOrQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const results: ResultItemType[] = [];
          for (const doc of snapshot.docs) {
            results.push({ ...(doc.data() as T), id: doc.id });
          }
          setData(results);
          setError(null);
          setIsLoading(false);
        },
        (err: FirestoreError) => {
          // Always stop the spinner first — even if path resolution fails below.
          setData(null);
          setIsLoading(false);

          let path = 'unknown';
          try {
            if (memoizedTargetRefOrQuery.type === 'collection') {
              path = (memoizedTargetRefOrQuery as CollectionReference).path;
            }
          } catch {
            // This is a best-effort attempt to get the path. If it fails for any
            // reason, we can safely ignore it and the path will remain 'unknown'.
          }

          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path,
          });

          setError(contextualError);

          // Only surface as a permission error for real access denials.
          // Other codes (failed-precondition = missing index, unavailable = offline, etc.)
          // should not trigger the "Firestore rules" warning toast.
          if (err.code === 'permission-denied') {
            errorEmitter.emit('permission-error', contextualError);
          } else {
            console.warn('[Firestore] Query error:', err.code, path, err.message);
          }
        }
      );
    } catch (e) {
        const err = e as Error;
        console.error("[Firestore] Error setting up listener:", err.message);
        setError(err);
        setIsLoading(false);
        // Can't unsubscribe if the setup failed, so return a no-op function
        unsubscribe = () => {};
    }


    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error };
}
