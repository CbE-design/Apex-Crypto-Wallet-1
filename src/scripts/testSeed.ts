import { fundAccountWithUsdt, publicClient } from '../lib/seedUsdt';
import { USDT_ADDRESS, USDT_ABI } from '../config/usdt';
import { formatUnits } from 'viem';

async function main() {
  // Anvil's default Account #0
  const targetWallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  console.log('Funding account with 5,000 USDT...');
  const receipt = await fundAccountWithUsdt(targetWallet, '5000');
  console.log('Seeded successfully! Tx Hash:', receipt.transactionHash);

  const balance = await publicClient.readContract({
    address: USDT_ADDRESS,
    abi: USDT_ABI,
    functionName: 'balanceOf',
    args: [targetWallet],
  });

  console.log(`Updated Local USDT Balance: ${formatUnits(balance, 6)} USDT`);
}

main().catch(console.error);
