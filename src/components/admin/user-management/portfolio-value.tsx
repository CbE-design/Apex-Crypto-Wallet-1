
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { portfolioAssets as staticAssets } from '@/lib/data';
import { useCurrency } from '@/context/currency-context';

interface PortfolioValueProps {
    userId: string;
}

interface UserWallet {
    balance: number;
    currency: string;
}

export function PortfolioValue({ userId }: PortfolioValueProps) {
    const firestore = useFirestore();
    const { formatCurrency, currency: selectedCurrency } = useCurrency();

    const walletsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(collection(firestore, 'users', userId, 'wallets'));
    }, [firestore, userId]);

    const { data: userWallets, isLoading } = useCollection<UserWallet>(walletsQuery);

    const totalValueUSD = useMemo(() => {
        if (!userWallets) return 0;
        return userWallets.reduce((acc, wallet) => {
            const assetInfo = staticAssets.find(a => a.symbol === wallet.currency);
            const price = assetInfo ? assetInfo.priceUSD : 0;
            return acc + (wallet.balance * price);
        }, 0);
    }, [userWallets]);
    
    const totalValueInSelectedCurrency = totalValueUSD * selectedCurrency.rate;

    if (isLoading) {
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    return (
        <span className="font-mono">
            {formatCurrency(totalValueInSelectedCurrency)}
        </span>
    );
}

    