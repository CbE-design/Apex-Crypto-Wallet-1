'use client';

import React from 'react';
import { Wallet, Bitcoin, ArrowUpRight, ArrowDownRight, Gem, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data for user's wallets
const wallets = [
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    balance: 50210.42,
    change: 2.5,
    cryptoAmount: '1.05 BTC',
    Icon: Bitcoin,
  },
  {
    name: 'Ethereum',
    symbol: 'ETH',
    balance: 16850.11,
    change: -1.2,
    cryptoAmount: '4.82 ETH',
    Icon: Gem, 
  },
  {
    name: 'Ripple',
    symbol: 'XRP',
    balance: 5012.77,
    change: 5.8,
    cryptoAmount: '8,421 XRP',
    Icon: Waves,
  },
];

// ✅ CORRECT: Standard Next.js Page component function returning JSX
export default function MyWalletsPage() {
  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Page Header - Styled like the admin pages for consistency */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Wallet className="h-5 w-5 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">My Wallets</h1>
        </div>
        <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-white/25 ml-1">
          On-Chain Asset Management
        </p>
      </div>

      {/* Responsive Grid for Wallet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wallets.map((wallet) => (
          <div 
            key={wallet.name} 
            className="bg-gray-900/50 hover:bg-gray-900/80 transition-colors p-4 rounded-lg border border-gray-800/50 flex justify-between items-center"
          >
            <div className="flex items-center gap-4">
              <wallet.Icon className="w-8 h-8 text-white" />
              <div>
                <p className="font-bold text-white">{wallet.name}</p>
                <p className="text-sm text-gray-400">{wallet.cryptoAmount}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-white">${wallet.balance.toLocaleString()}</p>
              <div className={cn(
                "text-xs font-bold flex items-center justify-end gap-1", 
                wallet.change >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {wallet.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>{Math.abs(wallet.change).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
