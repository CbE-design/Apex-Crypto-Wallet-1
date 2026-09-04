import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseAdmin } from '@/lib/firebase-admin';
import { getDb } from '@/lib/db';
import {
  APEX_ASSET,
  APEX_DECIMALS,
  getApexExplorerTxUrl,
} from '@/lib/apex-onchain';
import { settleApexToExternalWallet, getApexServerConfig } from '@/lib/apex-onchain-server';

export const runtime = 'nodejs';

type TransferBody = {
  asset?: string;
  recipientAddress?: string;
  amount?: string | number;
  clientRequestId?: string;
  complianceId?: string;
  travelRuleVerified?: boolean;
  note?: string;
};

function isValidAmount(value: string): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value) && Number(value) > 0;
}

/**
 * Settles an APEX balance to an external EVM wallet.
 *
 * The balance is reserved before the chain transaction is broadcast
 * and only finalized after the ERC-20 receipt confirms. If the chain fails,
 * the reservation is returned to the user's balance.
 */
export async function POST(req: NextRequest) {
  let db: ReturnType<typeof getDb> | null = null;
  let senderId = '';
  let requestId = '';
  let amount = '';

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    try {
      senderId = (await firebaseAdmin.auth().verifyIdToken(idToken)).uid;
    } catch {
      return NextResponse.json({ success: false, error: 'Your session has expired.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as TransferBody;
    const recipientAddress = String(body.recipientAddress || '').trim();
    amount = String(body.amount ?? '').trim();
    requestId = String(body.clientRequestId || '').trim();

    if (body.asset && String(body.asset).toUpperCase() !== APEX_ASSET) {
      return NextResponse.json({ success: false, error: 'Only APEX is currently enabled for on-chain settlement.' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipientAddress)) {
      return NextResponse.json({ success: false, error: 'Enter a valid external EVM wallet address.' }, { status: 400 });
    }
    if (!isValidAmount(amount)) {
      return NextResponse.json({ success: false, error: `Amount must be greater than zero and use at most ${APEX_DECIMALS} decimals.` }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
      return NextResponse.json({ success: false, error: 'A valid transfer request ID is required.' }, { status: 400 });
    }

    // Validate the chain/treasury before touching the user's balance.
    const serverConfig = getApexServerConfig();
    if (!serverConfig.rpcUrl || !serverConfig.tokenAddress || !serverConfig.settlementPrivateKey) {
      return NextResponse.json({
        success: false,
        code: 'ONCHAIN_NOT_CONFIGURED',
        error: 'External APEX transfers are not available yet.',
      }, { status: 503 });
    }

    db = getDb();
    const transferRef = db.collection('onchain_transfers').doc(requestId);
    const walletRef = db.collection('users').doc(senderId).collection('wallets').doc(APEX_ASSET);
    const senderRef = db.collection('users').doc(senderId);
    const transferSnap = await transferRef.get();

    if (transferSnap.exists) {
      const existing = transferSnap.data() || {};
      if (existing.status === 'CONFIRMED' && existing.txHash) {
        return NextResponse.json({
          success: true,
          status: 'CONFIRMED',
          txHash: existing.txHash,
          explorerUrl: existing.explorerUrl || getApexExplorerTxUrl(existing.txHash, serverConfig.explorerUrl),
          network: existing.chainName || serverConfig.chainName,
        });
      }
      if (existing.status !== 'FAILED') {
        return NextResponse.json({ success: false, error: 'This transfer is already being processed.', txHash: existing.txHash || null }, { status: 409 });
      }
    }

    const senderSnap = await senderRef.get();
    if (!senderSnap.exists) {
      return NextResponse.json({ success: false, error: 'Sender account not found.' }, { status: 404 });
    }
    const senderData = senderSnap.data() || {};
    if (senderData.isRestricted === true) {
      return NextResponse.json({ success: false, error: 'Restricted accounts cannot send external transfers.' }, { status: 403 });
    }

    const numericAmount = Number(amount);
    const reservedField = 'reservedForOnchainTransfer';

    // Reserve the balance atomically so concurrent requests cannot
    // spend the same APEX twice.
    await db.runTransaction(async (transaction) => {
      const walletSnap = await transaction.get(walletRef);
      const currentBalance = Number(walletSnap.data()?.balance || 0);
      const currentReserved = Number(walletSnap.data()?.[reservedField] || 0);
      if (!walletSnap.exists || currentBalance < numericAmount) {
        throw new Error('INSUFFICIENT_APEX_BALANCE');
      }

      transaction.set(walletRef, {
        id: APEX_ASSET,
        userId: senderId,
        currency: APEX_ASSET,
        balance: currentBalance - numericAmount,
        [reservedField]: currentReserved + numericAmount,
        lastSynced: FieldValue.serverTimestamp(),
      }, { merge: true });

      transaction.set(transferRef, {
        id: requestId,
        userId: senderId,
        asset: APEX_ASSET,
        amount: numericAmount,
        amountExact: amount,
        recipientAddress,
        status: 'RESERVED',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        complianceId: body.complianceId || `APEX_EXT_${requestId}`,
        travelRuleVerified: Boolean(body.travelRuleVerified),
        note: body.note || null,
        settlementMode: 'apex-treasury',
      }, { merge: true });
    });

    try {
      const settlement = await settleApexToExternalWallet(recipientAddress, amount);

      await db.runTransaction(async (transaction) => {
        const walletSnap = await transaction.get(walletRef);
        const walletData = walletSnap.data() || {};
        const currentReserved = Number(walletData[reservedField] || 0);

        transaction.set(walletRef, {
          [reservedField]: Math.max(0, currentReserved - numericAmount),
          lastSynced: FieldValue.serverTimestamp(),
        }, { merge: true });

        const txRef = senderRef.collection('transactions').doc();
        transaction.set(txRef, {
          type: 'External Transfer',
          currency: APEX_ASSET,
          amount: numericAmount,
          price: 0,
          status: 'Completed',
          timestamp: FieldValue.serverTimestamp(),
          from: settlement.settlementAddress,
          to: recipientAddress,
          recipient: recipientAddress,
          txHash: settlement.txHash,
        notes: body.note || 'Public on-chain APEX transfer',
          metadata: {
            travelRuleVerified: Boolean(body.travelRuleVerified),
            complianceId: body.complianceId || `APEX_EXT_${requestId}`,
            protocol: 'APEX_ONCHAIN_SETTLEMENT',
            settlementMode: 'apex-treasury',
            chainId: settlement.chainId,
            chainName: settlement.chainName,
            tokenAddress: settlement.tokenAddress,
            explorerUrl: settlement.explorerUrl,
            blockNumber: settlement.blockNumber,
            requestId,
          },
        });

        transaction.set(transferRef, {
          status: 'CONFIRMED',
          txHash: settlement.txHash,
          explorerUrl: settlement.explorerUrl,
          settlementAddress: settlement.settlementAddress,
          tokenAddress: settlement.tokenAddress,
          chainId: settlement.chainId,
          chainName: settlement.chainName,
          confirmedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });

      return NextResponse.json({
        success: true,
        status: 'CONFIRMED',
        txHash: settlement.txHash,
        explorerUrl: settlement.explorerUrl,
        network: settlement.chainName,
        settlementAddress: settlement.settlementAddress,
      });
    } catch (chainError: any) {
      // Return the balance if the chain transaction was never
      // confirmed. The transfer intent remains auditable as FAILED.
      await db.runTransaction(async (transaction) => {
        const walletSnap = await transaction.get(walletRef);
        const walletData = walletSnap.data() || {};
        const currentReserved = Number(walletData[reservedField] || 0);
        const currentBalance = Number(walletData.balance || 0);
        transaction.set(walletRef, {
          balance: currentBalance + numericAmount,
          [reservedField]: Math.max(0, currentReserved - numericAmount),
          lastSynced: FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(transferRef, {
          status: 'FAILED',
          error: chainError?.message || 'On-chain settlement failed.',
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      throw chainError;
    }
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_APEX_BALANCE') {
      return NextResponse.json({ success: false, error: 'Insufficient APEX balance.' }, { status: 400 });
    }
    console.error('[on-chain transfer] Failed:', error);
    return NextResponse.json({ success: false, error: error?.message || 'On-chain transfer failed.' }, { status: 500 });
  }
}