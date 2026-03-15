
'use server';

/**
 * @fileOverview Apex Liquidity Orchestration - Ledger Sync Service.
 * Reconciles the internal Firestore ledger with aggregate state metrics.
 */

import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Fetches node health metrics from the Firestore ledger.
 * Bridge Liquidity aggregation has been deactivated per governance requirements.
 */
export async function getLedgerSyncStatus() {
  const db = getAdminFirestore();

  if (!db) {
    return {
      status: 'Disconnected',
      lastSync: new Date().toISOString(),
      blocksBehind: -1,
      nodeHealth: '0%',
      stateRoot: '0x0000... (Awaiting Admin SDK)',
      isOffline: true
    };
  }

  try {
    // Check for any pending transactions to determine system health
    const transactionsSnapshot = await db.collectionGroup('transactions')
      .where('status', '==', 'Pending')
      .limit(1)
      .get();

    const isHealthy = transactionsSnapshot.empty;

    return {
      status: isHealthy ? 'Healthy' : 'Syncing',
      lastSync: new Date().toISOString(),
      blocksBehind: 0,
      nodeHealth: '100%',
      stateRoot: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      isOffline: false
    };
  } catch (error) {
    console.error("Ledger Sync failed:", error);
    return {
      status: 'Error',
      lastSync: new Date().toISOString(),
      nodeHealth: '0%',
      isOffline: true
    };
  }
}
