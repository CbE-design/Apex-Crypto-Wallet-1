// USDT contract deployed in Remix on Base mainnet.
export const USDT_ADDRESS = '0x27078CcA4f878f0FFAa4c6972478Ea7bd9B0b82d' as const;
export const USDT_CHAIN_ID = 8453n;
export const USDT_CHAIN_NAME = 'Base';
export const USDT_EXPLORER_URL = 'https://basescan.org';
export const USDT_RPC_URL = 'https://mainnet.base.org';

export const USDT_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
