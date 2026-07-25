import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getAdminFirestore, firebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendTransactionalEmail } from '@/lib/email';

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

    // Send deposit notification email if the user has a real email address.
    try {
      const userData = userDoc.data();
      if (userData.email && typeof userData.email === 'string' && userData.email.includes('@') && !userData.email.endsWith('@apex.io')) {
        await sendTransactionalEmail({
          to: userData.email,
          subject: `Deposit Received: ${value} ${asset}`,
          html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>Deposit Confirmed</title></head>
<body style="margin:0;padding:0;background:#0A0C12;color:#E5E7EB;font-family:sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#11131A;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:28px;">
      <div style="font-size:22px;font-weight:700;color:#22D3EE;margin-bottom:24px;">Apex Wallet</div>
      <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 16px;">Deposit Confirmed</h1>
      <p style="font-size:15px;line-height:1.6;color:#9CA3AF;">We have received a deposit into your wallet.</p>
      <div style="background:rgba(34,211,238,0.08);border-left:3px solid #22D3EE;padding:12px 16px;border-radius:8px;margin:16px 0;">
        Amount: <strong>${value} ${asset}</strong><br />
        Transaction: <code>${txHash}</code>
      </div>
    </div>
  </div>
</body></html>`,
        });
      }
    } catch (emailErr) {
      console.error('[AlchemyWebhook] Deposit email failed:', emailErr);
    }

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
