export const APXD_ADDRESS = (process.env.NEXT_PUBLIC_APXD_TOKEN_ADDRESS || '') as `0x${string}` | '';
export const APXD_CHAIN_ID = 8453n;
export const APXD_CHAIN_NAME = 'Base';
export const APXD_DECIMALS = 18;
export const APXD_EXPLORER_URL = 'https://basescan.org';
export const APXD_RPC_URL = 'https://mainnet.base.org';

export const APXD_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function mint(address to, uint256 amount)',
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;

export function isApxdConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(APXD_ADDRESS);
}
