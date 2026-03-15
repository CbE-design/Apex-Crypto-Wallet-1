# Apex Crypto Wallet - Orchestration Terminal

This is the production-ready Apex Private Ledger management system.

## Production Setup: Connecting the Admin SDK

To enable **Bridge Liquidity** aggregation and **Global Notifications**, you must link the Firebase Admin SDK:

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Project Settings** > **Service Accounts**.
3. Click **Generate new private key**.
4. Download the JSON file.
5. In your project root, open (or create) a `.env` file.
6. Add the following line, replacing the value with the contents of your JSON file:
   `FIREBASE_ADMIN_SDK_CONFIG='{"type": "service_account", ...}'`
7. Restart your development server.

## Administrative Access
The account with the wallet address ending in `da94` is hardcoded as the **System Governor**. Only this address can access the Orchestration Terminal and toggle the global Protocol Gate.
