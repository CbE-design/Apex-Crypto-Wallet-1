// Base currently exposes a bridged USDT representation, not a Tether-issued native token.
export const USDT_ADDRESS = '0xfde4C96c8593536e31F229EA8f37b2ADa2699bb2' as const;
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
