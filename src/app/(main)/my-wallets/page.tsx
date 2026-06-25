'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import { Wallet } from '@/lib/types';

/**
 * The main component for the My Wallets page.
 * This component is responsible for fetching and displaying the user's crypto wallets.
 * It uses the `useCollection` hook to get real-time updates from Firestore.
 * It also provides a button to create a new wallet (functionality to be implemented).
 */
export default function MyWalletsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'wallets'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: wallets, isLoading } = useCollection<Wallet>(walletsQuery);

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Wallets</h1>
        <Button disabled>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Wallet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Cryptocurrency Wallets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading && <p>Loading wallets...</p>}
            {!isLoading && wallets?.length === 0 && <p>You don't have any wallets yet.</p>}
            {wallets?.map(wallet => (
              <Card key={wallet.id} className="overflow-hidden">
                <CardHeader className="bg-white/[0.04]">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{wallet.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-2">
                  <div className="text-sm text-muted-foreground">Balance</div>
                  <div className="text-2xl font-bold">
                    {wallet.balance.toFixed(8)} {wallet.symbol}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
