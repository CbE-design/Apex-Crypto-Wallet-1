import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/lib/firebaseAdmin';

/**
 * Types for Alchemy webhook payload
 */
interface AlchemyWebhookActivity {
  fromAddress: string;
  toAddress: string;
  hash: string;
  value: number;
  asset?: string;
  blockNum?: string;
  rawContract?: {
    value: string;
    address: string;
    decimals: string;
  };
}

interface AlchemyWebhookEvent {
  network: string;
  activity: AlchemyWebhookActivity[];
}

interface AlchemyWebhookPayload {
  webhookId: string;
  type: string;
  event: AlchemyWebhookEvent;
  createdAt?: string;
}

interface WebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
  userId?: string;
  txHash?: string;
}

/**
 * Validate HMAC-SHA256 signature using timing-safe comparison
 * 
 * @param rawBody - The raw request body as string (before JSON parsing)
 * @param signature - The signature from x-alchemy-signature header
 * @param signingKey - The webhook signing key from environment
 * @returns true if signature is valid, false otherwise
 */
const validateSignature = (
  rawBody: string,
  signature: string,
  signingKey: string
): boolean => {
  try {
    // Compute HMAC-SHA256 of the raw body
    const hmac = createHmac('sha256', signingKey);
    hmac.update(rawBody);
    const computedSignature = hmac.digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return createHmac('sha256', signingKey)
      .update(signature)
      .digest()
      .equals(
        createHmac('sha256', signingKey)
          .update(computedSignature)
          .digest()
      );
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
};

/**
 * Process incoming Alchemy webhook activity and update Firestore
 */
const processAlchemyActivity = async (
  activity: AlchemyWebhookActivity
): Promise<{ success: boolean; userId?: string; txHash?: string; error?: string }> => {
  try {
    // Normalize recipient address to lowercase
    const recipientAddress = activity.toAddress.toLowerCase();
    const asset = activity.asset || 'APEX';
    const amount = Number(activity.value);
    const timestamp = new Date().toISOString();

    // Query Firestore users collection where walletAddressLowercase matches
    const usersSnapshot = await db
      .collection('users')
      .where('walletAddressLowercase', '==', recipientAddress)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.warn(`No user found for address: ${recipientAddress}`);
      return {
        success: false,
        error: `No user found for wallet: ${recipientAddress}`,
      };
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;

    // Fetch current wallet balance
    const walletDocRef = db.collection('users').doc(userId).collection('wallets').doc(asset);
    const walletDoc = await walletDocRef.get();
    const currentBalance = walletDoc.exists ? (walletDoc.data()?.balance || 0) : 0;

    // Calculate new balance
    const newBalance = currentBalance + amount;

    // Update wallet balance with merge: true
    await walletDocRef.set(
      {
        balance: newBalance,
        lastUpdated: new Date(),
      },
      { merge: true }
    );

    // Record transaction in subcollection
    await db
      .collection('users')
      .doc(userId)
      .collection('transactions')
      .add({
        asset,
        amount,
        action: 'RECEIVE',
        from: activity.fromAddress,
        txHash: activity.hash,
        timestamp,
        createdAt: new Date(),
      });

    console.info(
      `✓ Updated user ${userId}: ${asset} balance ${currentBalance} → ${newBalance}, tx: ${activity.hash}`
    );

    return {
      success: true,
      userId,
      txHash: activity.hash,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing Alchemy activity:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Main webhook handler for Alchemy ADDRESS_ACTIVITY events
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get environment variable
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
    if (!signingKey) {
      console.error('ALCHEMY_WEBHOOK_SIGNING_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'Webhook signing key not configured' },
        { status: 401 }
      );
    }

    // Get signature from header
    const signature = request.headers.get('x-alchemy-signature');
    if (!signature) {
      console.warn('Missing x-alchemy-signature header');
      return NextResponse.json(
        { success: false, error: 'Missing authentication signature' },
        { status: 401 }
      );
    }

    // Read raw body BEFORE parsing JSON (critical for HMAC validation)
    const rawBody = await request.text();

    // Validate signature using timing-safe comparison
    const isValidSignature = validateSignature(rawBody, signature, signingKey);
    if (!isValidSignature) {
      console.warn('Invalid webhook signature');
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Parse JSON after signature validation
    let body: AlchemyWebhookPayload;
    try {
      body = JSON.parse(rawBody) as AlchemyWebhookPayload;
    } catch (error) {
      console.error('Invalid JSON payload');
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate payload structure
    if (!body.event || !Array.isArray(body.event.activity) || body.event.activity.length === 0) {
      console.warn('Invalid or empty activity in webhook payload');
      return NextResponse.json(
        { success: false, error: 'No activity found in payload' },
        { status: 400 }
      );
    }

    // Only process ADDRESS_ACTIVITY type
    if (body.type !== 'ADDRESS_ACTIVITY') {
      console.info(`Skipping webhook type: ${body.type}`);
      return NextResponse.json(
        { success: true, message: `Webhook type ${body.type} not processed` },
        { status: 200 }
      );
    }

    // Process first activity only
    const activity = body.event.activity[0];

    // Validate required fields
    if (!activity.fromAddress || !activity.toAddress || activity.value === undefined) {
      console.error('Missing required activity fields', activity);
      return NextResponse.json(
        { success: false, error: 'Missing required transaction fields' },
        { status: 400 }
      );
    }

    // Process the activity
    const result = await processAlchemyActivity(activity);

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Activity processed successfully',
          userId: result.userId,
          txHash: result.txHash,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to process activity',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook handler error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'Alchemy webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
}
