import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { USDT_ADDRESS, USDT_ABI } from '../config/usdt';

const BINANCE_WHALE = '0x28C6c06298d514Db089934071355E5743bf21d60';

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('http://127.0.0.1:8545'),
});

export async function fundAccountWithUsdt(targetAddress: `0x${string}`, amount: string) {
  // Impersonate the Binance whale on your local Anvil node
  await publicClient.request({
    method: 'anvil_impersonateAccount' as any,
    params: [BINANCE_WHALE],
  });

  // Give the whale local ETH so it can pay for transaction gas
  await publicClient.request({
    method: 'anvil_setBalance' as any,
    params: [BINANCE_WHALE, '0x56BC75E2D63100000'],
  });

  const whaleWalletClient = createWalletClient({
    account: BINANCE_WHALE,
    chain: mainnet,
    transport: http('http://127.0.0.1:8545'),
  });

  // Transfer USDT (uses 6 decimal places)
  const txHash = await whaleWalletClient.writeContract({
    address: USDT_ADDRESS,
    abi: USDT_ABI,
    functionName: 'transfer',
    args: [targetAddress, parseUnits(amount, 6)],
  });

  // Release control of the whale wallet
  await publicClient.request({
    method: 'anvil_stopImpersonatingAccount' as any,
    params: [BINANCE_WHALE],
  });

  return await publicClient.waitForTransactionReceipt({ hash: txHash });
}
