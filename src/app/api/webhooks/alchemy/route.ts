import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getAdminFirestore, firebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

interface AlchemyWebhookPayload {
  webhookId: string;
  id: string;
  createdAt: string;
  type: string;
  event: {
    activity: Array<{
      fromAddress: string;
      toAddress: string;
      blockNum: string;
      hash: string;
      value: number | string;
      asset?: string;
      category: string;
      rawContract?: {
        value: string | null;
        address: string | null;
        decimal: string | null;
      };
    }>;
  };
}

/**
 * Verify HMAC SHA-256 signature from Alchemy webhook
 */
function verifySignature(
  body: string,
  signature: string,
  signingKey: string
): boolean {
  try {
    const hmac = createHmac('sha256', signingKey);
    hmac.update(body);
    const digest = hmac.digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);

    return timingSafeEqual(signatureBuffer, digestBuffer);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Process deposit activity and update user balance and transaction records
 */
async function processDeposit(
  toAddress: string,
  fromAddress: string,
  value: number,
  asset: string,
  txHash: string
): Promise<void> {
  try {
    const db = getAdminFirestore();
    if (!db) throw new Error('Firestore admin not initialised');

    // Query user by wallet address (case-insensitive)
    const usersSnap = await db
      .collection('users')
      .where('walletAddressLowercase', '==', toAddress.toLowerCase())
      .limit(1)
      .get();

    if (usersSnap.empty) {
      console.warn(`No user found for wallet address: ${toAddress}`);
      return;
    }

    const userDoc = usersSnap.docs[0];
    const userId = userDoc.id;

    // Use batch write for atomic operations
    const batch = db.batch();

    // Wallet ref
    const walletRef = db.doc(`users/${userId}/wallets/${asset}`);

    // Increment wallet balance (merge to create if missing)
    batch.set(
      walletRef,
      {
        balance: FieldValue.increment(value),
        lastUpdated: FieldValue.serverTimestamp(),
        currency: asset,
        id: asset,
        userId,
      },
      { merge: true }
    );

    // Record transaction
    const transactionsCol = db.collection('users').doc(userId).collection('transactions');
    const newTransactionRef = transactionsCol.doc();

    batch.set(newTransactionRef, {
      asset,
      amount: value,
      action: 'RECEIVE',
      from: fromAddress.toLowerCase(),
      txHash,
      timestamp: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // Commit batch
    await batch.commit();

    console.log(`Successfully processed deposit: ${value} ${asset} to ${userId}`);
  } catch (error) {
    console.error('Error processing deposit:', error);
    throw error;
  }
}

/**
 * POST handler for Alchemy webhook notifications
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get signing key
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
    const signature = request.headers.get('x-alchemy-signature');

    if (!signingKey || !signature) {
      return NextResponse.json(
        { error: 'Missing signing key or signature' },
        { status: 401 }
      );
    }

    // Read raw body for signature verification
    const rawBody = await request.text();

    // Verify signature
    if (!verifySignature(rawBody, signature, signingKey)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Parse payload
    const payload: AlchemyWebhookPayload = JSON.parse(rawBody);

    // Extract first activity
    if (!payload.event?.activity?.[0]) {
      return NextResponse.json(
        { error: 'No activity found in webhook' },
        { status: 400 }
      );
    }

    const activity = payload.event.activity[0];

    // Extract and validate required fields
    const toAddress = activity.toAddress;
    const fromAddress = activity.fromAddress;
    const txHash = activity.hash;
    const asset = activity.asset || 'APEX';
    const value = typeof activity.value === 'string'
      ? parseFloat(activity.value)
      : (activity.value as number);

    if (!toAddress || !fromAddress || !txHash || isNaN(value)) {
      return NextResponse.json(
        { error: 'Missing required fields in activity' },
        { status: 400 }
      );
    }

    // Process the deposit
    await processDeposit(toAddress, fromAddress, value, asset, txHash);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler - returns 405 Method Not Allowed
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
