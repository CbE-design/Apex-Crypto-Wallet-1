import { ethers } from 'ethers';

/**
 * APEX is the on-chain representation of the virtual Apex ledger.
 *
 * The application remains a virtual ledger, but external settlement is backed
 * by a real ERC-20 transfer from the configured Apex settlement treasury. That
 * distinction is intentionally exposed in the UI and transaction metadata.
 */
export const APEX_ASSET = 'APEX' as const;
export const APEX_DECIMALS = 18;
export const APEX_DEFAULT_CHAIN_ID = 11155111; // Sepolia; safe testnet default.
export const APEX_DEFAULT_CHAIN_NAME = 'Sepolia';
export const APEX_DEFAULT_EXPLORER_URL = 'https://sepolia.etherscan.io';

export const APEX_ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;

export interface ApexOnchainConfig {
  chainId: number;
  chainName: string;
  explorerUrl: string;
  rpcUrl: string;
  tokenAddress: string;
  configured: boolean;
}

function normalizeExplorerUrl(value: string | undefined): string {
  return (value || APEX_DEFAULT_EXPLORER_URL).replace(/\/+$/, '');
}

/**
 * Public client-side configuration. The RPC URL may be public, but the
 * settlement private key is deliberately never exposed here.
 */
export function getApexOnchainConfig(): ApexOnchainConfig {
  const tokenAddress = process.env.NEXT_PUBLIC_APEX_TOKEN_ADDRESS || '';
  const rpcUrl = process.env.NEXT_PUBLIC_APEX_RPC_URL || '';
  const chainId = Number(process.env.NEXT_PUBLIC_APEX_CHAIN_ID || APEX_DEFAULT_CHAIN_ID);
  const chainName = process.env.NEXT_PUBLIC_APEX_CHAIN_NAME || APEX_DEFAULT_CHAIN_NAME;
  const explorerUrl = normalizeExplorerUrl(process.env.NEXT_PUBLIC_APEX_EXPLORER_URL);

  return {
    chainId: Number.isFinite(chainId) ? chainId : APEX_DEFAULT_CHAIN_ID,
    chainName,
    explorerUrl,
    rpcUrl,
    tokenAddress,
    configured: Boolean(rpcUrl && ethers.isAddress(tokenAddress)),
  };
}

export function getApexExplorerTxUrl(txHash: string, explorerUrl?: string): string {
  return `${normalizeExplorerUrl(explorerUrl || getApexOnchainConfig().explorerUrl)}/tx/${txHash}`;
}

export function isValidExternalEvmAddress(address: string): boolean {
  return ethers.isAddress(address.trim());
}

export function formatApexAmount(amount: string | number): string {
  return ethers.formatUnits(ethers.parseUnits(String(amount), APEX_DECIMALS), APEX_DECIMALS);
}