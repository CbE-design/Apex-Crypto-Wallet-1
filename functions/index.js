import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import * as crypto from 'crypto';
import { ethers } from 'ethers';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Placeholder for secure private key retrieval.
// In a real application, this would be a secure lookup, not a hardcoded env variable.
function getGatewayPrivateKey(depositAddress: string): string | null {
    // For this example, we'll use a single private key for all gateways.
    // In a real system, you might have different private keys for different deposit addresses
    // or a more sophisticated key management system.
    const privateKey = process.env.GATEWAY_PRIVATE_KEY;
    if (!privateKey) {
        logger.error("GATEWAY_PRIVATE_KEY environment variable is not set.");
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
export const handleOnChainDeposit = onRequest(
  // We can add runtime options, e.g., { region: 'us-central1' }
  async (request, response) => {
    // 1. Validate Request Method
    if (request.method !== "POST") {
      logger.warn("Received non-POST request to webhook endpoint.");
      response.status(405).json({ success: false, error: "Method Not Allowed" });
      return;
    }

    let txHash: string;
    let depositAddress: string;
    let amount: number;
    let asset: string; // e.g., "ETH", "USDT"

    try {
      // 2. Parse and Validate Incoming JSON Payload
      const { txHash: bodyTxHash, depositAddress: bodyDepositAddress, amount: bodyAmount, asset: bodyAsset } = request.body;

      txHash = bodyTxHash;
      depositAddress = bodyDepositAddress;
      amount = bodyAmount;
      asset = bodyAsset;

      if (!txHash || !depositAddress || !amount || !asset) {
        logger.error("Validation Failed: Missing one or more required fields in webhook payload.", request.body);
        response.status(400).json({ success: false, error: "Invalid payload. 'txHash', 'depositAddress', 'amount', and 'asset' are required." });
        return;
      }

      if (typeof amount !== 'number' || amount <= 0) {
        logger.error("Validation Failed: Invalid amount provided.", { amount });
        response.status(400).json({ success: false, error: "The 'amount' must be a positive number." });
        return;
      }

      // Prepare a reference to the document that logs processed deposits for idempotency checks.
      const processedDepositRef = db.collection("processed_deposits").doc(txHash);

      // 3. Start Atomic Firestore Transaction
      logger.info(`Starting transaction for deposit txHash: ${txHash}`);
      await db.runTransaction(async (transaction) => {
        // Step 1: Idempotency Check - Prevent Double-Crediting
        const depositDoc = await transaction.get(processedDepositRef);
        if (depositDoc.exists) {
          logger.info(`Idempotency check failed: Deposit ${txHash} has already been processed. Aborting transaction.`);
          // Exit transaction gracefully. The function will return a 200 OK status below.
          return;
        }

        // Step 2: Identify the User
        logger.info(`Searching for user with deposit address: ${depositAddress} for asset: ${asset}`);
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
        logger.info(`User ${userId} identified for the deposit.`);

        // Step 3: Credit User's Balance
        // Based on provided codebase snippets, user balances are stored in a 'wallets' subcollection.
        const userWalletRef = db.doc(`users/${userId}/wallets/${asset}`);
        const walletDoc = await transaction.get(userWalletRef);
        
        const currentBalance = walletDoc.exists ? (walletDoc.data()?.balance || 0) : 0;
        const newBalance = currentBalance + amount;

        logger.info(`Updating balance for user ${userId}, asset ${asset}. Old: ${currentBalance}, New: ${newBalance}`);
        // Atomically update the user's wallet balance.
        transaction.update(userWalletRef, { balance: newBalance });

        // Step 4: Log the Event to ensure Idempotency
        logger.info(`Locking transaction by creating document at processed_deposits/${txHash}`);
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
      logger.info(`Firestore transaction for ${txHash} completed successfully.`);

      // 4. Implement On-Chain Wallet Sweeping (Independent of Firestore transaction)
      // This block needs to be outside the Firestore transaction
      // so that if it fails, the Firestore credit is NOT reverted.
      try {
        logger.info(`Attempting to sweep funds from depositAddress: ${depositAddress} for asset: ${asset}`);
        const providerUrl = process.env.ALCHEMY_RPC_URL;
        const gatewayPrivateKey = getGatewayPrivateKey(depositAddress);

        if (!providerUrl || !gatewayPrivateKey) {
          logger.error("Sweeping Failed: Missing ALCHEMY_RPC_URL or GATEWAY_PRIVATE_KEY environment variables. Skipping sweep.");
          // Even if sweep config is missing, Firestore credit was successful, so return 200.
          return response.status(200).json({ success: true, message: "Deposit processed. Sweep skipped due to missing config." });
        }

        const provider = new ethers.JsonRpcProvider(providerUrl);
        const wallet = new ethers.Wallet(gatewayPrivateKey, provider);

        // Fetch current on-chain balance of the deposit address
        const onChainBalanceWei = await provider.getBalance(depositAddress);
        const onChainBalanceEth = parseFloat(ethers.formatEther(onChainBalanceWei));

        logger.info(`On-chain balance for ${depositAddress}: ${onChainBalanceEth} ETH`);

        if (onChainBalanceEth <= 0) {
            logger.info(`No balance to sweep from ${depositAddress}. Skipping sweep.`);
            return response.status(200).json({ success: true, message: "Deposit processed. No funds to sweep." });
        }
        
        // Estimate gas price
        const gasPrice = await provider.getGasPrice();
        const gasLimit = 21000n; // Standard gas limit for a simple ETH transfer
        const estimatedGasCostWei = gasPrice * gasLimit;
        const estimatedGasCostEth = parseFloat(ethers.formatEther(estimatedGasCostWei));

        logger.info(`Estimated gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
        logger.info(`Estimated gas cost: ${estimatedGasCostEth} ETH`);

        // Calculate sweep amount (on-chain balance - gas cost)
        let sweepAmountWei = onChainBalanceWei - estimatedGasCostWei;

        // Ensure sweepAmount is not negative
        if (sweepAmountWei <= 0n) {
            logger.warn(`Sweep amount is zero or negative after deducting gas for ${depositAddress}. Skipping sweep.`, { onChainBalanceEth, estimatedGasCostEth });
            return response.status(200).json({ success: true, message: "Deposit processed. Sweep skipped due to insufficient funds for gas." });
        }

        // Send the remaining funds to the master vault wallet
        logger.info(`Sweeping ${ethers.formatEther(sweepAmountWei)} ETH from ${depositAddress} to ${MASTER_VAULT_ADDRESS}`);
        const tx = await wallet.sendTransaction({
          to: MASTER_VAULT_ADDRESS,
          value: sweepAmountWei,
          gasPrice: gasPrice,
          gasLimit: gasLimit,
        });

        logger.info(`Sweep transaction sent. TxHash: ${tx.hash}`);
        await tx.wait(); // Wait for the transaction to be mined
        logger.info(`Sweep transaction confirmed. TxHash: ${tx.hash}`);

        response.status(200).json({ success: true, message: "Deposit processed and funds swept successfully." });

      } catch (sweepError) {
        logger.error(`On-chain sweeping failed for txHash: ${txHash}. Firestore credit was successful.`, sweepError);
        // Do NOT return a 500 here, as the Firestore credit was successful.
        // Log the error but return a 200 for the webhook sender.
        response.status(200).json({ success: true, message: "Deposit processed. Funds sweeping encountered an error, check logs." });
      }

    } catch (error) {
      logger.error("Error processing deposit webhook:", error);

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
