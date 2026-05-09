'use client';

import { useEffect, useRef } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * Listens for globally emitted 'permission-error' events and surfaces them
 * as toast notifications instead of crashing the entire React tree.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();
  const shownPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      const key = error.message?.slice(0, 80) ?? 'permission';

      // Deduplicate — don't spam the same error repeatedly
      if (shownPaths.current.has(key)) return;
      shownPaths.current.add(key);

      // Log for debugging without crashing the app
      console.warn('[Firestore] Permission error:', error.message);

      toast({
        title: 'Access Restricted',
        description: 'Some data could not be loaded due to permissions. If you are an admin, please ensure Firestore rules are up to date.',
        variant: 'destructive',
        duration: 6000,
      });

      // Clear dedup key after a delay so future genuine errors can still surface
      setTimeout(() => shownPaths.current.delete(key), 30_000);
    };

    errorEmitter.on('permission-error', handleError);
    return () => errorEmitter.off('permission-error', handleError);
  }, [toast]);

  return null;
}
