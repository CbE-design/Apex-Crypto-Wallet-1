import 'server-only';

import { ethers } from 'ethers';
import { APXD_ADDRESS, APXD_RPC_URL, APXD_CHAIN_ID, APXD_CHAIN_NAME, APXD_EXPLORER_URL, APXD_ABI } from '@/config/apxd';
import { USDT_ADDRESS, USDT_RPC_URL, USDT_CHAIN_ID, USDT_CHAIN_NAME, USDT_EXPLORER_URL } from '@/config/usdt';

export type BaseToken = 'APXD' | 'USDT';

const USDT_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;

function getTokenConfig(asset: BaseToken) {
  if (asset === 'APXD') {
    return {
      address: APXD_ADDRESS,
      rpcUrl: APXD_RPC_URL,
      chainId: Number(APXD_CHAIN_ID),
      chainName: APXD_CHAIN_NAME,
      explorerUrl: APXD_EXPLORER_URL,
      abi: APXD_ABI,
    };
  }

  return {
    address: USDT_ADDRESS,
    rpcUrl: USDT_RPC_URL,
    chainId: Number(USDT_CHAIN_ID),
    chainName: USDT_CHAIN_NAME,
    explorerUrl: USDT_EXPLORER_URL,
    abi: USDT_ABI,
  };
}

export async function settleBaseTokenToWallet(asset: BaseToken, recipientAddress: string, amount: string) {
  const config = getTokenConfig(asset);
  const privateKey = process.env.APEX_ONCHAIN_PRIVATE_KEY || '';
  const configuredTreasury = process.env.APXD_TREASURY_ADDRESS || process.env.NEXT_PUBLIC_APXD_TREASURY_ADDRESS || '';

  if (!ethers.isAddress(recipientAddress)) throw new Error('Recipient is not a valid Base wallet address.');
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('APEX_ONCHAIN_PRIVATE_KEY is not configured.');
  if (!config.address || !ethers.isAddress(config.address)) throw new Error(`${asset} token address is not configured.`);

  const provider = new ethers.JsonRpcProvider(config.rpcUrl, {
    name: config.chainName,
    chainId: config.chainId,
  });
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) {
    throw new Error(`Configured Base RPC is on chain ${network.chainId}, expected ${config.chainId}.`);
  }

  const signer = new ethers.Wallet(privateKey, provider);
  if (configuredTreasury && signer.address.toLowerCase() !== configuredTreasury.toLowerCase()) {
    throw new Error('APEX_ONCHAIN_PRIVATE_KEY does not match APXD_TREASURY_ADDRESS.');
  }

  const token = new ethers.Contract(config.address, config.abi, signer);
  const decimals = Number(await token.decimals());
  const parsedAmount = ethers.parseUnits(amount, decimals);
  if (parsedAmount <= 0n) throw new Error('Amount must be greater than zero.');

  const treasuryBalance = await token.balanceOf(signer.address) as bigint;
  if (treasuryBalance < parsedAmount) throw new Error(`The treasury does not have enough ${asset}.`);

  const tx = await token.transfer(recipientAddress, parsedAmount);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error(`The ${asset} transaction was not confirmed.`);

  return {
    asset,
    amount,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    settlementAddress: signer.address,
    chainId: config.chainId,
    chainName: config.chainName,
    tokenAddress: config.address,
    explorerUrl: `${config.explorerUrl}/tx/${tx.hash}`,
  };
}
