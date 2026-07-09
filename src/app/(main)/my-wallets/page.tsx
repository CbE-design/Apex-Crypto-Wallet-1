import { useEffect, useState } from 'react';
import { db } from '@/firebase/config'; // Double-check if your configuration path matches this
import { doc, onSnapshot } from 'firebase/firestore';

export default function BalanceCard({ userId }) {
  const [balance, setBalance] = useState(0);
  const [fiatValue, setFiatValue] = useState(0);
  const ZAR_PRICE = 28098.60;

  // 1. Listen to the user document live in Firestore
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        // Target your brand new nested map field safely
        const ethBalance = userData.internal_balances?.ETH || 0;
        setBalance(ethBalance);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // 2. Automatically recalculate the fiat value whenever the balance changes
  useEffect(() => {
    setFiatValue(balance * ZAR_PRICE);
  }, [balance]);

  return (
    <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
      <h3 className="text-gray-400 text-sm">Available Ethereum Balance</h3>
      
      {/* Crypto Balance Display (e.g., 0.0100 ETH) */}
      <p className="text-2xl font-bold text-white mt-2">
        {balance.toFixed(4)} ETH
      </p>

      {/* Dynamic Fiat Balance Display (e.g., ≈ ZAR 280.99) */}
      <p className="text-sm text-gray-500 mt-1">
        ≈ ZAR {fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}