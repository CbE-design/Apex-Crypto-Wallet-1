import 'server-only';

import { ethers } from 'ethers';
import {
  APEX_ASSET,
  APEX_DECIMALS,
  APEX_DEFAULT_CHAIN_ID,
  APEX_DEFAULT_CHAIN_NAME,
  APEX_DEFAULT_EXPLORER_URL,
  APEX_ERC20_ABI,
  getApexExplorerTxUrl,
} from '@/lib/apex-onchain';

export interface ApexServerConfig {
  chainId: number;
  chainName: string;
  explorerUrl: string;
  rpcUrl: string;
  tokenAddress: string;
  treasuryAddress: string;
  settlementPrivateKey: string;
}

export function getApexServerConfig(): ApexServerConfig {
  const rpcUrl = process.env.APEX_ONCHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_APEX_RPC_URL || '';
  const tokenAddress =
    process.env.APEX_ONCHAIN_TOKEN_ADDRESS ||
    process.env.APXD_TOKEN_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_APXD_TOKEN_ADDRESS ||
    process.env.USDT_TOKEN_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_APEX_TOKEN_ADDRESS ||
    '';
  const settlementPrivateKey = process.env.APEX_ONCHAIN_PRIVATE_KEY || '';
  const treasuryAddress = process.env.APXD_TREASURY_ADDRESS || process.env.NEXT_PUBLIC_APXD_TREASURY_ADDRESS || '';
  const chainId = Number(process.env.APEX_ONCHAIN_CHAIN_ID || process.env.NEXT_PUBLIC_APEX_CHAIN_ID || APEX_DEFAULT_CHAIN_ID);
  const chainName = process.env.APEX_ONCHAIN_CHAIN_NAME || process.env.NEXT_PUBLIC_APEX_CHAIN_NAME || APEX_DEFAULT_CHAIN_NAME;
  const explorerUrl = (process.env.APEX_ONCHAIN_EXPLORER_URL || process.env.NEXT_PUBLIC_APEX_EXPLORER_URL || APEX_DEFAULT_EXPLORER_URL).replace(/\/+$/, '');

  return {
    chainId: Number.isFinite(chainId) ? chainId : APEX_DEFAULT_CHAIN_ID,
    chainName,
    explorerUrl,
    rpcUrl,
    tokenAddress,
    treasuryAddress,
    settlementPrivateKey,
  };
}

export function assertApexServerConfig(config: ApexServerConfig): void {
  if (!config.rpcUrl) throw new Error('APEX_ONCHAIN_RPC_URL is not configured.');
  if (!ethers.isAddress(config.tokenAddress)) throw new Error('APEX_ONCHAIN_TOKEN_ADDRESS is not a valid contract address.');
  if (!/^0x[0-9a-fA-F]{64}$/.test(config.settlementPrivateKey)) {
    throw new Error('APEX_ONCHAIN_PRIVATE_KEY is not configured.');
  }
  if (config.treasuryAddress && !ethers.isAddress(config.treasuryAddress)) {
    throw new Error('APXD_TREASURY_ADDRESS is not a valid EVM address.');
  }
}

export async function getApexSettlementContext() {
  const config = getApexServerConfig();
  assertApexServerConfig(config);

  const provider = new ethers.JsonRpcProvider(config.rpcUrl, {
    name: config.chainName,
    chainId: config.chainId,
  });
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) {
    throw new Error(`Configured APEX RPC is on chain ${network.chainId}, expected ${config.chainId}.`);
  }

  const signer = new ethers.Wallet(config.settlementPrivateKey, provider);
  if (config.treasuryAddress && signer.address.toLowerCase() !== config.treasuryAddress.toLowerCase()) {
    throw new Error('APEX_ONCHAIN_PRIVATE_KEY does not match APXD_TREASURY_ADDRESS.');
  }
  const token = new ethers.Contract(config.tokenAddress, APEX_ERC20_ABI, signer);
  const tokenDecimals = Number(await token.decimals());
  if (tokenDecimals !== APEX_DECIMALS) {
    throw new Error(`APEX token decimals are ${tokenDecimals}; expected ${APEX_DECIMALS}.`);
  }

  return { config, provider, signer, token };
}

export async function settleApexToExternalWallet(recipientAddress: string, amount: string) {
  const { config, provider, signer, token } = await getApexSettlementContext();
  if (!ethers.isAddress(recipientAddress)) throw new Error('Recipient is not a valid EVM address.');

  const parsedAmount = ethers.parseUnits(amount, APEX_DECIMALS);
  if (parsedAmount <= 0n) throw new Error('Amount must be greater than zero.');

  const treasuryBalance = await token.balanceOf(signer.address) as bigint;
  if (treasuryBalance < parsedAmount) {
    throw new Error('The Apex on-chain settlement treasury does not have enough APEX.');
  }

  const tx = await token.transfer(recipientAddress, parsedAmount);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error('The APEX transaction was not confirmed.');
  }

  return {
    asset: APEX_ASSET,
    amount,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    settlementAddress: signer.address,
    chainId: config.chainId,
    chainName: config.chainName,
    tokenAddress: config.tokenAddress,
    explorerUrl: getApexExplorerTxUrl(tx.hash, config.explorerUrl),
    provider,
  };
}
