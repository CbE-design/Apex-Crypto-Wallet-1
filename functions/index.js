
const {https} = require("firebase-functions/v2");
const {log} = require("firebase-functions/logger");
const admin = require("firebase-admin");
const ethers = require("ethers");

admin.initializeApp();

// This is a placeholder for the master vault address.
// In a production environment, you should store this in a secure way,
// such as a Firebase secret.
const MASTER_VAULT_ADDRESS = "0x...YOUR_MASTER_VAULT_ADDRESS...";

// This function retrieves the gateway private key for a given deposit address.
// In a real-world scenario, you would need a secure way to store and retrieve
// these keys. For this example, we'll use a placeholder function.
function getGatewayPrivateKey(depositAddress) {
    // In a real implementation, you would look up the private key
    // associated with the depositAddress from a secure storage.
    // For this example, we are using a placeholder.
    // IMPORTANT: Never expose private keys in your code.
    // Use Firebase secrets or another secure key management system.
    return process.env.GATEWAY_PRIVATE_KEY;
}

exports.handleOnChainDeposit = https.onRequest({
    secrets: ["GATEWAY_PRIVATE_KEY", "ALCHEMY_RPC_URL", "ALCHEMY_SIGNING_KEY"]
}, async (request, response) => {
    try {
        const body = request.body;

     // 2. Parse the Incoming Webhook
        const activity = body.event.activity[0];
        const txHash = activity.hash;
        const depositAddress = activity.toAddress;
        let amount = activity.value;
        let asset = activity.asset; // The token symbol (e.g., "ETH", "USDC")

        // 3. Basic Validation
        if (!txHash || !depositAddress || !amount || !asset) {
            log("Validation Failed: Missing required fields from Alchemy payload.", { txHash, depositAddress, amount, asset });
            return response.status(400).json({ success: false, error: "Missing required fields." });
        }

        log(`Processing deposit: ${amount} ${asset} to ${depositAddress} (Tx: ${txHash})`);

        // 4. Credit User's Account in Firestore
        const db = admin.firestore();
        const userRef = db.collection('users').where(`deposit_gateways.${asset}`, '==', depositAddress).limit(1);

        await db.runTransaction(async (transaction) => {
            const userSnapshot = await transaction.get(userRef);

            if (userSnapshot.empty) {
                log(`No user found for deposit address: ${depositAddress}`);
                // Do not throw an error to prevent the webhook from being retried.
                return;
            }

            const userDoc = userSnapshot.docs[0];
            const accountRef = userDoc.ref.collection('accounts').doc(asset);

            const accountSnapshot = await transaction.get(accountRef);

            let newBalance;
            if (accountSnapshot.exists) {
                const currentBalance = accountSnapshot.data().balance || 0;
                newBalance = currentBalance + parseFloat(amount);
                transaction.update(accountRef, { balance: newBalance });
            } else {
                newBalance = parseFloat(amount);
                transaction.set(accountRef, { balance: newBalance });
            }

            const depositRecordRef = userDoc.ref.collection('deposits').doc(txHash);
            transaction.set(depositRecordRef, {
                amount: parseFloat(amount),
                asset,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                depositAddress,
            });

            log(`Successfully credited ${userDoc.id} with ${amount} ${asset}. New balance: ${newBalance}`);
        });

        // Return success immediately after the database credit!
        return response.status(200).json({ success: true, message: "Deposit processed and credited safely." });

    } catch (error) {
        log("Error processing deposit:", error);
        return response.status(500).json({ success: false, error: "Internal Server Error" });
    }
});
