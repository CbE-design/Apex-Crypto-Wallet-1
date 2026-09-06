'use client';

import * as React from 'react';
import { ethers } from 'ethers';
import { APXD_ABI, APXD_ADDRESS, APXD_CHAIN_ID, APXD_CHAIN_NAME, APXD_DECIMALS, APXD_RPC_URL, isApxdConfigured } from '@/config/apxd';

export function useLiveApxdBalance(address?: string | null) {
  const [balance, setBalance] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!address || !isApxdConfigured() || !ethers.isAddress(address)) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const provider = new ethers.JsonRpcProvider(APXD_RPC_URL, {
        name: APXD_CHAIN_NAME,
        chainId: Number(APXD_CHAIN_ID),
      });
      const contract = new ethers.Contract(APXD_ADDRESS, APXD_ABI, provider);
      const rawBalance = await contract.balanceOf(address);
      setBalance(Number(ethers.formatUnits(rawBalance, APXD_DECIMALS)));
    } catch (cause) {
      console.error('[v0] Failed to read APXD balance:', cause);
      setBalance(null);
      setError('Live APXD balance is temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  React.useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { balance, error, isLoading, refresh };
}
