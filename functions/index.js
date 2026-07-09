const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");
const { ethers } = require("ethers");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Placeholder for secure private key retrieval.
// In a real application, this would be a secure lookup, not a hardcoded env variable.
function getGatewayPrivateKey(depositAddress) {
    // For this example, we'll use a single private key for all gateways.
    // In a real system, you might have different private keys for different deposit addresses
    // or a more sophisticated key management system.
    const privateKey = process.env.GATEWAY_PRIVATE_KEY;
    if (!privateKey) {
        functions.logger.error("GATEWAY_PRIVATE_KEY environment variable is not set.");
        return null;
    }
    return privateKey;
}

const MASTER_VAULT_ADDRESS = "0xbBb97f6facf78271a2Cd9f481c6B5F8796B17F58"; // Your platform's central vault

/**
 * Firebase Cloud Function to handle incoming webhook alerts for on-chain cryptocurrency deposits.
 * Triggered by an HTTP POST request.
 *
 * @param {object} request - The HTTP request object, containing the deposit details in the body.
 * @param {object} response - The HTTP response object used to send back a status.
 */
exports.handleOnChainDeposit = functions.runWith({
    secrets: ["GATEWAY_PRIVATE_KEY", "ALCHEMY_RPC_URL", "ALCHEMY_SIGNING_KEY"]
}).https.onRequest(
  // We can add runtime options, e.g., { region: 'us-central1' }
  async (request, response) => {
    // 1. Validate Request Method
    if (request.method !== "POST") {
      functions.logger.warn("Received non-POST request to webhook endpoint.");
      response.status(405).json({ success: false, error: "Method Not Allowed" });
      return;
    }

    let txHash;
    let depositAddress;
    let amount;
    let asset;

    try {
      // 2. Parse Incoming Alchemy JSON Payload
      const activity = request.body.event?.activity?.[0];

      if (!activity) {
          functions.logger.warn("No activity found in Alchemy webhook payload.", request.body);
          response.status(200).send("No activity"); // Acknowledge without processing
          return;
      }

      txHash = activity.hash;
      depositAddress = activity.toAddress;
      amount = activity.value; // Assuming Alchemy provides amount as a number or string convertible to number
      asset = activity.asset || "ETH"; // Default to ETH if not specified by Alchemy

      if (!txHash || !depositAddress || typeof amount === 'undefined' || amount === null || !asset) {
          functions.logger.error("Validation Failed: Missing required fields in Alchemy payload.", activity);
          response.status(400).json({ success: false, error: "Invalid payload from Alchemy. 'hash', 'toAddress', 'value', and 'asset' are required." });
          return;
      }

      // Additional validation for amount type and value
      if (typeof amount !== 'number' || amount <= 0) {
        functions.logger.error("Validation Failed: Invalid amount provided in Alchemy payload.", { amount, txHash });
        response.status(400).json({ success: false, error: "The 'amount' must be a positive number." });
        return;
      }

      // Prepare a reference to the document that logs processed deposits for idempotency checks.
      const processedDepositRef = db.collection("processed_deposits").doc(txHash);

      // 3. Start Atomic Firestore Transaction
      functions.logger.info(`Starting transaction for deposit txHash: ${txHash}`);
      await db.runTransaction(async (transaction) => {
        // Step 1: Idempotency Check - Prevent Double-Crediting
        const depositDoc = await transaction.get(processedDepositRef);
        if (depositDoc.exists) {
          functions.logger.info(`Idempotency check failed: Deposit ${txHash} has already been processed. Aborting transaction.`);
          // Exit transaction gracefully. The function will return a 200 OK status below.
          return;
        }

        // Step 2: Identify the User
        functions.logger.info(`Searching for user with deposit address: ${depositAddress} for asset: ${asset}`);
        const usersRef = db.collection("users");
        // The path `deposit_gateways.${asset}` is dynamically queried.
        const userQuery = usersRef.where(`deposit_gateways.${asset}`, "==", depositAddress).limit(1);
        const userSnapshot = await transaction.get(userQuery);

        if (userSnapshot.empty) {
          // This is a critical error. The webhook sent a deposit for an address we can't match.
          // This transaction will throw an error and be rolled back.
          throw new Error(`User not found for deposit address ${depositAddress} and asset ${asset}.`);
        }

        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        functions.logger.info(`User ${userId} identified for the deposit.`);

        // Step 3: Credit User's Balance
        // Based on provided codebase snippets, user balances are stored in a 'wallets' subcollection.
        const userWalletRef = db.doc(`users/${userId}/wallets/${asset}`);
        const walletDoc = await transaction.get(userWalletRef);
        
        const currentBalance = walletDoc.exists ? (walletDoc.data()?.balance || 0) : 0;
        const newBalance = currentBalance + amount;

        functions.logger.info(`Updating balance for user ${userId}, asset ${asset}. Old: ${currentBalance}, New: ${newBalance}`);
        // Atomically update the user's wallet balance.
        transaction.update(userWalletRef, { balance: newBalance });

        // Step 4: Log the Event to ensure Idempotency
        functions.logger.info(`Locking transaction by creating document at processed_deposits/${txHash}`);
        transaction.set(processedDepositRef, {
          txHash,
          depositAddress,
          amount,
          asset,
          creditedToUser: userId,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "COMPLETED"
        });
      });

      // If the transaction completes successfully (or was already processed)
      functions.logger.info(`Firestore transaction for ${txHash} completed successfully.`);

      // 4. Implement On-Chain Wallet Sweeping (Independent of Firestore transaction)
      // This block needs to be outside the Firestore transaction
      // so that if it fails, the Firestore credit is NOT reverted.
      try {
        functions.logger.info(`Attempting to sweep funds from depositAddress: ${depositAddress} for asset: ${asset}`);
        const providerUrl = process.env.ALCHEMY_RPC_URL;
        const gatewayPrivateKey = getGatewayPrivateKey(depositAddress);

        if (!providerUrl || !gatewayPrivateKey) {
          functions.logger.error("Sweeping Failed: Missing ALCHEMY_RPC_URL or GATEWAY_PRIVATE_KEY environment variables. Skipping sweep.");
          // Even if sweep config is missing, Firestore credit was successful, so return 200.
          return response.status(200).json({ success: true, message: "Deposit processed. Sweep skipped due to missing config." });
        }

        const provider = new ethers.JsonRpcProvider(providerUrl);
        const wallet = new ethers.Wallet(gatewayPrivateKey, provider);

        // Fetch current on-chain balance of the deposit address
        const onChainBalanceWei = await provider.getBalance(depositAddress);
        const onChainBalanceEth = parseFloat(ethers.formatEther(onChainBalanceWei));

        functions.logger.info(`On-chain balance for ${depositAddress}: ${onChainBalanceEth} ETH`);

        if (onChainBalanceEth <= 0) {
            functions.logger.info(`No balance to sweep from ${depositAddress}. Skipping sweep.`);
            return response.status(200).json({ success: true, message: "Deposit processed. No funds to sweep." });
        }
        
        // Estimate gas price
        const gasPrice = await provider.getGasPrice();
        const gasLimit = 21000n; // Standard gas limit for a simple ETH transfer
        const estimatedGasCostWei = gasPrice * gasLimit;
        const estimatedGasCostEth = parseFloat(ethers.formatEther(estimatedGasCostWei));

        functions.logger.info(`Estimated gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
        functions.logger.info(`Estimated gas cost: ${estimatedGasCostEth} ETH`);

        // Calculate sweep amount (on-chain balance - gas cost)
        let sweepAmountWei = onChainBalanceWei - estimatedGasCostWei;

        // Ensure sweepAmount is not negative
        if (sweepAmountWei <= 0n) {
            functions.logger.warn(`Sweep amount is zero or negative after deducting gas for ${depositAddress}. Skipping sweep.`, { onChainBalanceEth, estimatedGasCostEth });
            return response.status(200).json({ success: true, message: "Deposit processed. Sweep skipped due to insufficient funds for gas." });
        }

        // Send the remaining funds to the master vault wallet
        functions.logger.info(`Sweeping ${ethers.formatEther(sweepAmountWei)} ETH from ${depositAddress} to ${MASTER_VAULT_ADDRESS}`);
        const tx = await wallet.sendTransaction({
          to: MASTER_VAULT_ADDRESS,
          value: sweepAmountWei,
          gasPrice: gasPrice,
          gasLimit: gasLimit,
        });

        functions.logger.info(`Sweep transaction sent. TxHash: ${tx.hash}`);
        await tx.wait(); // Wait for the transaction to be mined
        functions.logger.info(`Sweep transaction confirmed. TxHash: ${tx.hash}`);

        response.status(200).json({ success: true, message: "Deposit processed and funds swept successfully." });

      } catch (sweepError) {
        functions.logger.error(`On-chain sweeping failed for txHash: ${txHash}. Firestore credit was successful.`, sweepError);
        // Do NOT return a 500 here, as the Firestore credit was successful.
        // Log the error but return a 200 for the webhook sender.
        response.status(200).json({ success: true, message: "Deposit processed. Funds sweeping encountered an error, check logs." });
      }

    } catch (error) {
      functions.logger.error("Error processing deposit webhook:", error);

      // Return appropriate error code based on the failure
      if (error.message.startsWith("User not found")) {
        // This is a client-side error from the webhook provider's perspective (sent to a wrong/old address)
        response.status(400).json({ success: false, error: error.message });
      } else {
        // Any other error is a server-side failure.
        response.status(500).json({ success: false, error: "An internal server error occurred." });
      }
    }
  }
);

// Add the getCustomToken function back as an export
exports.getCustomToken = functions.https.onCall(async (data, context) => {
  const { walletAddress } = data;

  if (!walletAddress) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with one argument 'walletAddress'.",
    );
  }

  const db = admin.firestore();
  const usersRef = db.collection("users");
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
