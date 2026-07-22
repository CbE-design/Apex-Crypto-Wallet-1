import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Types for Alchemy webhook payload
 */
interface AlchemyWebhookActivity {
  fromAddress: string;
  toAddress: string;
  hash: string;
  value: number;
  asset: string;
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
  message: string;
  processedTransactions?: number;
  errors?: string[];
}

/**
 * Normalize Ethereum addresses to lowercase for consistency
 */
const normalizeAddress = (address: string): string => {
  return address.toLowerCase();
};

/**
 * Validate webhook signature (optional but recommended)
 * If Alchemy provides an X-Alchemy-Signature header, verify it
 */
const validateWebhookSignature = (
  request: NextRequest,
  payload: string
): boolean => {
  const signature = request.headers.get('x-alchemy-signature');
  
  // If no signature provided, you may want to enforce this
  if (!signature) {
    console.warn('No webhook signature provided');
    return true; // Set to false if signature validation is required
  }

  // Implement HMAC-SHA256 verification with your webhook signing key
  // This is a placeholder - implement actual verification based on Alchemy's spec
  return true;
};

/**
 * Process incoming transaction activity and update user balances
 */
const processTransaction = async (
  activity: AlchemyWebhookActivity,
  transaction: { hash: string; timestamp: number }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const fromAddress = normalizeAddress(activity.fromAddress);
    const toAddress = normalizeAddress(activity.toAddress);
    const value = activity.value;
    const asset = activity.asset || 'UNKNOWN';

    // Update sender balance (decrease)
    if (fromAddress && fromAddress !== '0x0000000000000000000000000000000000000000') {
      await updateUserBalance(fromAddress, -value, asset, transaction);
    }

    // Update recipient balance (increase)
    if (toAddress && toAddress !== '0x0000000000000000000000000000000000000000') {
      await updateUserBalance(toAddress, value, asset, transaction);
    }

    // Log transaction for audit trail
    await logTransaction({
      hash: activity.hash,
      fromAddress,
      toAddress,
      value,
      asset,
      timestamp: transaction.timestamp,
      blockNum: activity.blockNum,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing transaction:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Update user balance in Firestore
 */
const updateUserBalance = async (
  address: string,
  amount: number,
  asset: string,
  transaction: { hash: string; timestamp: number }
): Promise<void> => {
  const userDocRef = db.collection('users').doc(address);

  await db.runTransaction(async (transaction_ref) => {
    const userDoc = await transaction_ref.get(userDocRef);
    
    if (!userDoc.exists) {
      // Create new user document
      transaction_ref.set(
        userDocRef,
        {
          address,
          [asset]: {
            balance: amount >= 0 ? amount : 0,
            rawBalance: amount,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          transactionHistory: [
            {
              hash: transaction.hash,
              amount,
              asset,
              timestamp: transaction.timestamp,
            },
          ],
        },
        { merge: false }
      );
    } else {
      // Update existing user document
      const currentData = userDoc.data() || {};
      const currentAssetData = currentData[asset] || { balance: 0, rawBalance: 0 };
      const newBalance = Math.max(
        0,
        (currentAssetData.rawBalance || currentAssetData.balance || 0) + amount
      );

      transaction_ref.update(userDocRef, {
        [asset]: {
          balance: newBalance,
          rawBalance: newBalance,
          lastUpdated: new Date(),
        },
        updatedAt: new Date(),
        transactionHistory: db.FieldValue.arrayUnion({
          hash: transaction.hash,
          amount,
          asset,
          timestamp: transaction.timestamp,
        }),
      });
    }
  });
};

/**
 * Log transaction for audit trail and analysis
 */
const logTransaction = async (transactionData: {
  hash: string;
  fromAddress: string;
  toAddress: string;
  value: number;
  asset: string;
  timestamp: number;
  blockNum?: string;
}): Promise<void> => {
  try {
    await db.collection('transactions').add({
      ...transactionData,
      createdAt: new Date(),
      processed: true,
    });
  } catch (error) {
    console.error('Error logging transaction:', error);
    // Don't throw - transaction was processed, logging failure is non-critical
  }
};

/**
 * Main webhook handler
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify request method
    if (request.method !== 'POST') {
      return NextResponse.json(
        { success: false, message: 'Method not allowed' },
        { status: 405 }
      );
    }

    // Parse request body
    const body = await request.json() as AlchemyWebhookPayload;

    // Validate webhook signature
    const rawBody = await request.text();
    if (!validateWebhookSignature(request, rawBody)) {
      console.warn('Invalid webhook signature');
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Validate payload structure
    if (!body.event || !Array.isArray(body.event.activity)) {
      console.error('Invalid webhook payload structure');
      return NextResponse.json(
        { success: false, message: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    // Check webhook type
    if (body.type !== 'ADDRESS_ACTIVITY') {
      console.info(`Skipping webhook of type: ${body.type}`);
      return NextResponse.json(
        { success: true, message: `Webhook type ${body.type} received but not processed` },
        { status: 200 }
      );
    }

    const activities = body.event.activity;
    const errors: string[] = [];
    let processedCount = 0;

    // Process each transaction in the activity
    for (const activity of activities) {
      try {
        // Validate activity data
        if (!activity.fromAddress || !activity.toAddress || activity.value === undefined) {
          const error = 'Missing required activity fields';
          console.warn(error, activity);
          errors.push(error);
          continue;
        }

        const transaction = {
          hash: activity.hash || `unknown_${Date.now()}`,
          timestamp: Math.floor(Date.now() / 1000),
        };

        const result = await processTransaction(activity, transaction);

        if (result.success) {
          processedCount++;
          console.info(`✓ Processed transaction: ${activity.hash}`);
        } else {
          const error = `Failed to process transaction ${activity.hash}: ${result.error}`;
          console.error(error);
          errors.push(error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const message = `Error processing activity: ${errorMessage}`;
        console.error(message);
        errors.push(message);
      }
    }

    // Return response
    const response: WebhookResponse = {
      success: errors.length === 0,
      message: `Processed ${processedCount} of ${activities.length} transactions`,
      processedTransactions: processedCount,
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    console.info('Webhook processing complete:', response);

    return NextResponse.json(response, {
      status: errors.length === 0 ? 200 : 207, // 207 Partial Success
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook handler error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        errors: [errorMessage],
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
