import { getFirestore } from "firebase-admin/firestore";
import { app } from "./firebase-admin"; // Adjust to point to your existing Firebase init file

export const db = getFirestore(app);
