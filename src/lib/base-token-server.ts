import 'server-only';

import { ethers } from 'ethers';
import { APXD_ADDRESS, APXD_DECIMALS, APXD_RPC_URL, APXD_CHAIN_ID, APXD_CHAIN_NAME, APXD_EXPLORER_URL } from '@/config/apxd';
import { USDT_ADDRESS, USDT_CHAIN_ID, USDT_CHAIN_NAME, USDT_EXPLORER_URL, USDT_RPC_URL } from '@/config/usdt';

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
] as const;

export type BaseToken = 'APXD' | 'USDT';

const tokenConfig = {
  APXD: { address: APXD_ADDRESS, decimals: APXD_DECIMALS, chainId: APXD_CHAIN_ID, chainName: APXD_CHAIN_NAME, rpcUrl: APXD_RPC_URL, explorerUrl: APXD_EXPLORER_URL },
  USDT: { address: USDT_ADDRESS, decimals: 6, chainId: USDT_CHAIN_ID, chainName: USDT_CHAIN_NAME, rpcUrl: USDT_RPC_URL, explorerUrl: USDT_EXPLORER_URL },
} as const;

function validAmount(value: string) {
  return /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value) && Number(value) > 0;
}

export async function settleBaseTokenToWallet(asset: BaseToken, recipient: string, amount: string) {
  const config = tokenConfig[asset];
  const privateKey = process.env.APEX_ONCHAIN_PRIVATE_KEY || '';
  const treasury = process.env.APXD_TREASURY_ADDRESS || process.env.NEXT_PUBLIC_APXD_TREASURY_ADDRESS || '';
  if (!ethers.isAddress(config.address)) throw new Error(`${asset} contract is not configured.`);
  if (!ethers.isAddress(recipient)) throw new Error('Recipient is not a valid EVM address.');
  if (!validAmount(amount)) throw new Error(`Amount must be positive and use at most ${config.decimals} decimals.`);
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('Base treasury signer is not configured.');
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, { name: config.chainName, chainId: Number(config.chainId) });
  const network = await provider.getNetwork();
  if (network.chainId !== config.chainId) throw new Error(`Configured RPC is not ${config.chainName}.`);
  const signer = new ethers.Wallet(privateKey, provider);
  if (treasury && signer.address.toLowerCase() !== treasury.toLowerCase()) throw new Error('Treasury signer does not match the configured treasury address.');
  const token = new ethers.Contract(config.address, ERC20_ABI, signer);
  const decimals = Number(await token.decimals());
  if (decimals !== config.decimals) throw new Error(`${asset} decimals do not match configuration.`);
  const parsed = ethers.parseUnits(amount, decimals);
  const balance = await token.balanceOf(signer.address) as bigint;
  if (balance < parsed) throw new Error(`Treasury has insufficient ${asset}.`);
  const tx = await token.transfer(recipient, parsed);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error(`${asset} transfer was not confirmed.`);
  return { txHash: tx.hash, blockNumber: receipt.blockNumber, tokenAddress: config.address, chainId: config.chainId.toString(), chainName: config.chainName, explorerUrl: `${config.explorerUrl}/tx/${tx.hash}`, settlementAddress: signer.address };
}

export function getBaseTokenConfig(asset: BaseToken) { return tokenConfig[asset]; }
export { APXD_ADDRESS, USDT_ADDRESS };
