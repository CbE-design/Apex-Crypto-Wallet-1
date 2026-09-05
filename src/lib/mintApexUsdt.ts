import axios from 'axios';
import { ethers } from 'ethers';

export async function requestApexMint(apiUrl: string, userId: string, metamaskAddress: string, amount: number) {
  const res = await axios.post(`${apiUrl}/api/mint-request`, { userId, metamaskAddress, amount });
  return res.data; // { txHash }
}

export async function addTokenToMetaMask(tokenAddress: string, symbol = 'USDT', decimals = 6, imageUrl = '') {
  if (!(window as any).ethereum) throw new Error('MetaMask not found');
  try {
    const wasAdded = await (window as any).ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: { address: tokenAddress, symbol, decimals, image: imageUrl },
      },
    });
    return wasAdded;
  } catch (err) {
    console.error('watchAsset error', err);
    return false;
  }
}
