import 'server-only';

import { settleApexToExternalWallet } from '@/lib/apex-onchain-server';

export type BaseToken = 'APXD' | 'USDT';

/**
 * Settles supported Base assets from the configured treasury to a user wallet.
 * APXD uses the existing on-chain settlement implementation. USDT remains
 * ledger-backed until a dedicated USDT treasury configuration is provided.
 */
export async function settleBaseTokenToWallet(
  asset: BaseToken,
  recipientAddress: string,
  amount: string,
) {
  if (asset !== 'APXD') {
    throw new Error('USDT on-chain settlement is not configured for this treasury.');
  }

  return settleApexToExternalWallet(recipientAddress, amount);
}
