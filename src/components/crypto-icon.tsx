'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const CDN = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color';

const NAME_TO_SYMBOL: Record<string, string> = {
  'apex coin': 'apex',
  apex: 'apex',
  bitcoin: 'btc',
  ethereum: 'eth',
  solana: 'sol',
  bnb: 'bnb',
  cardano: 'ada',
  xrp: 'xrp',
  chainlink: 'link',
  dogecoin: 'doge',
  tether: 'usdt',
  'usd coin': 'usdc',
  polkadot: 'dot',
  avalanche: 'avax',
  polygon: 'matic',
  litecoin: 'ltc',
  'shiba inu': 'shib',
  uniswap: 'uni',
  cosmos: 'atom',
  stellar: 'xlm',
  monero: 'xmr',
  algorand: 'algo',
};

const SYMBOL_COLORS: Record<string, string> = {
  apex: '#22D3EE',
  btc: '#F7931A', eth: '#627EEA', sol: '#9945FF', bnb: '#F0B90B',
  ada: '#0033AD', xrp: '#00AAE4', link: '#2A5ADA', doge: '#C2A633',
  usdt: '#26A17B', usdc: '#2775CA', dot: '#E6007A', avax: '#E84142',
  matic: '#8247E5', ltc: '#A5A5A5', uni: '#FF007A', atom: '#2E3148',
};

function resolveSymbol(name: string): string | null {
  const lower = name.toLowerCase();
  if (NAME_TO_SYMBOL[lower]) return NAME_TO_SYMBOL[lower];
  const parts = lower.split(/\s+/);
  if (parts[0]) return parts[0].substring(0, 4);
  return null;
}

export function CryptoIcon({ name, className }: { name: string; className?: string }) {
  const [error, setError] = useState(false);
  const sym = resolveSymbol(name);
  const url = sym ? `${CDN}/${sym}.png` : null;
  const initials = name.substring(0, 2).toUpperCase();
  const bgColor = sym ? (SYMBOL_COLORS[sym] ?? '#3B8EF3') : '#3B8EF3';

  if (!url || error) {
    return (
      <div
        className={cn('rounded-full flex items-center justify-center text-white font-bold shrink-0', className)}
        style={{ background: bgColor, fontSize: '0.6em' }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className={cn('rounded-full object-cover shrink-0', className)}
      onError={() => setError(true)}
    />
  );
}
