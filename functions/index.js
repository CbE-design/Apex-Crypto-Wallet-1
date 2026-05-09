
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

admin.initializeApp();

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
