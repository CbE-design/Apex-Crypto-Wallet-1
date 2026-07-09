
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require('crypto');

// Initialize Firebase Admin SDK once
admin.initializeApp();

/**
 * Creates a custom authentication token for a user identified by their wallet address.
 */
exports.getCustomToken = functions.https.onCall(async (data, context) => {
  const { walletAddress } = data;

  if (!walletAddress) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with one argument 'walletAddress'.",
    );
  }

  const db = getFirestore();
  const usersRef = db.collection("users");
  // Query for the user document based on a case-insensitive wallet address match.
  const q = usersRef.where("walletAddressLowercase", "==", walletAddress.toLowerCase()).limit(1);
  const userSnap = await q.get();

  if (userSnap.empty) {
     throw new functions.https.HttpsError(
      "not-found",
      "No user found with this wallet address.",
    );
  }

  const userDoc = userSnap.docs[0];
  const uid = userDoc.id;

  try {
    // Create a custom token for the found user UID.
    const customToken = await admin.auth().createCustomToken(uid);
    return { token: customToken };
  } catch (error) {
    console.error("Error creating custom token:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Could not create custom token.",
    );
  }
});

/**
 * Handles on-chain deposit webhooks from Alchemy.
 */
exports.handleOnChainDeposit = functions.https.onRequest(async (req, res) => {
  // 1. SECURITY CHECK: Verify the request signature to ensure it's from Alchemy.
  const signature = req.headers['x-alchemy-signature'];
  const signingKey = process.env.ALCHEMY_SIGNING_KEY; 
  
  if (!signingKey) {
    console.error("Missing Alchemy signing key in environment variables.");
    return res.status(500).send("Server configuration error.");
  }

  // Recalculate the signature to validate the payload.
  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(req.rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error("Invalid signature on incoming webhook. Potential spoofing attempt.");
    return res.status(403).send("Unauthorized");
  }

  // 2. EXTRACT DATA: Parse the webhook payload from Alchemy.
  const activity = req.body.event?.activity?.[0];
  if (!activity) {
    // Acknowledge receipt but do nothing if there's no relevant activity.
    return res.status(200).send("No activity found in payload.");
  }

  const { hash: txHash, toAddress: depositAddress, value: amount, asset } = activity;

  if (!txHash || !depositAddress || !amount || !asset) {
      return res.status(400).send("Invalid payload, missing required fields.");
  }

  const db = admin.firestore();
  const txRef = db.collection('processed_deposits').doc(txHash);

  try {
    // 3. ATOMIC DATABASE UPDATE: Use a Firestore transaction to safely credit the user.
    await db.runTransaction(async (transaction) => {
      
      // A. Idempotency Check: Exit if this transaction has already been processed.
      const txDoc = await transaction.get(txRef);
      if (txDoc.exists) {
        console.log(`Skipping already processed transaction: ${txHash}`);
        return; 
      }

      // B. User Lookup: Find the user whose deposit gateway matches the transaction.
      const userSnapshot = await db.collection('users')
        .where(`deposit_gateways.${asset}`, '==', depositAddress)
        .limit(1)
        .get();
      
      if (userSnapshot.empty) {
        console.log(`No Apex user found for deposit address: ${depositAddress} and asset: ${asset}`);
        return; // Exit transaction if no user is found.
      }

      const userDoc = userSnapshot.docs[0];
      const userRef = userDoc.ref;

      // C. Balance Update: Fetch the subcollection wallet document and calculate new balance.
const walletRef = userRef.collection('wallets').doc(asset);
const walletDoc = await transaction.get(walletRef);
const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;
const newBalance = currentBalance + amount;

// D. Atomically update the user's subcollection wallet balance.
transaction.set(walletRef, {
  balance: newBalance,
  asset: asset
}, { merge: true });

      // E. Log Receipt: Mark this transaction as processed to prevent double-crediting.
      transaction.set(txRef, {
        txHash, 
        asset, 
        amount, 
        depositAddress,
        creditedUser: userDoc.id,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.log(`Successfully processed deposit for ${amount} ${asset} from tx: ${txHash}`);
    return res.status(200).send("Deposit processed successfully.");

  } catch (error) {
    console.error(`Transaction failed for txHash ${txHash}:`, error);
    return res.status(500).send("Database transaction failed.");
  }
});
