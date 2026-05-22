'use client';

import { getFunctions } from 'firebase/functions';
import { getApp } from 'firebase/app';

/**
 * Returns the Firebase Functions client instance.
 * Must be called from a client component after Firebase has been initialised
 * by FirebaseProvider.
 */
export function getClientFunctions() {
  return getFunctions(getApp());
}
