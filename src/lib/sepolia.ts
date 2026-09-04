import { ethers } from 'ethers';

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_NETWORK_NAME = 'sepolia';
export const SEPOLIA_RPC_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
export const SEPOLIA_EXPLORER_URL = 'https://sepolia.etherscan.io';

/**
 * Public RPC fallback keeps the client self-custodial and avoids putting a
 * provider API key in the browser. Deployments can override it with
 * NEXT_PUBLIC_SEPOLIA_RPC_URL if they use a dedicated RPC provider.
 */
export function getSepoliaProvider() {
  return new ethers.JsonRpcProvider(
    SEPOLIA_RPC_URL,
    { name: SEPOLIA_NETWORK_NAME, chainId: SEPOLIA_CHAIN_ID },
  );
}

export function getSepoliaTransactionUrl(txHash: string) {
  return `${SEPOLIA_EXPLORER_URL}/tx/${txHash}`;
}