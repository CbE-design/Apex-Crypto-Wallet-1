'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { APXD_ABI, APXD_ADDRESS, APXD_CHAIN_ID, APXD_CHAIN_NAME, APXD_DECIMALS, APXD_EXPLORER_URL, APXD_RPC_URL, APXD_TREASURY_ADDRESS, isApxdConfigured } from '@/config/apxd';

interface ApxdEthereumProvider { request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>; }

export function ApxdTreasuryControls() {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = isApxdConfigured();

  const ensureBase = async () => {
    const ethereum = window.ethereum as ApxdEthereumProvider | undefined;
    if (!ethereum) throw new Error('Install MetaMask to use the treasury signer.');
    const chainIdHex = `0x${APXD_CHAIN_ID.toString(16)}`;
    try {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
    } catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: chainIdHex, chainName: APXD_CHAIN_NAME, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [APXD_RPC_URL], blockExplorerUrls: [APXD_EXPLORER_URL] }] });
    }
  };

  const sendTransaction = async (method: 'mint' | 'transfer') => {
    if (!configured) { toast({ title: 'APXD is not deployed', description: 'Set NEXT_PUBLIC_APXD_TOKEN_ADDRESS after deploying the contract on Base.', variant: 'destructive' }); return; }
    if (!ethers.isAddress(recipient)) { toast({ title: 'Invalid recipient', description: 'Enter a valid Base/EVM address.', variant: 'destructive' }); return; }
    let parsedAmount: bigint;
    try { parsedAmount = ethers.parseUnits(amount, APXD_DECIMALS); } catch { toast({ title: 'Invalid amount', description: 'Enter a positive APXD amount.', variant: 'destructive' }); return; }
    if (parsedAmount <= 0n) return;
    setBusy(true);
    try {
      await ensureBase();
      const ethereum = window.ethereum as ApxdEthereumProvider | undefined;
      if (!ethereum) throw new Error('Install MetaMask to use the treasury signer.');
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const signerAddress = accounts?.[0];
      if (!signerAddress) throw new Error('No signer account selected.');
      const provider = new ethers.BrowserProvider(window.ethereum as never);
      const network = await provider.getNetwork();
      if (network.chainId !== APXD_CHAIN_ID) throw new Error('MetaMask must be connected to Base Mainnet.');
      const signer = await provider.getSigner();
      const token = new ethers.Contract(APXD_ADDRESS, APXD_ABI, signer);
      const mintRecipient = APXD_TREASURY_ADDRESS || recipient;
  const tx = method === 'mint' ? await token.mint(mintRecipient, parsedAmount) : await token.transfer(recipient, parsedAmount);
      await tx.wait(1);
      toast({ title: method === 'mint' ? 'APXD minted' : 'APXD transferred', description: `${amount} APXD sent to ${recipient.slice(0, 6)}…${recipient.slice(-4)}.`, action: <a href={`${APXD_EXPLORER_URL}/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-xs underline">View transaction</a> });
      setAmount('');
    } catch (error) { toast({ title: 'Transaction failed', description: error instanceof Error ? error.message : 'MetaMask rejected the transaction.', variant: 'destructive' }); } finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03] p-5 space-y-4">
    <div><p className="text-sm font-bold text-white">Apex Dollar (APXD)</p><p className="text-xs leading-5 text-white/45">Base Mainnet · 18 decimals · transparent Apex-issued token. Not official Tether USD₮.</p>{APXD_TREASURY_ADDRESS && <p className="mt-2 break-all text-xs text-cyan-300/70">Treasury: {APXD_TREASURY_ADDRESS}</p>}</div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="apxd-recipient" className="text-xs text-white/55">Recipient Base address</Label><Input id="apxd-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x…" className="bg-white/[0.04] border-white/[0.08]" /></div>
      <div className="space-y-1.5"><Label htmlFor="apxd-amount" className="text-xs text-white/55">Amount APXD</Label><Input id="apxd-amount" type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="bg-white/[0.04] border-white/[0.08]" /></div>
    </div>
    <div className="flex flex-wrap gap-2"><Button onClick={() => void sendTransaction('mint')} disabled={busy || !recipient || !amount}>{busy ? 'Waiting for MetaMask…' : 'Mint APXD'}</Button><Button variant="outline" onClick={() => void sendTransaction('transfer')} disabled={busy || !recipient || !amount}>Transfer APXD</Button></div>
    {!configured && <p className="text-xs text-amber-300/80">Deployment required: set <code>NEXT_PUBLIC_APXD_TOKEN_ADDRESS</code> after deploying <code>contracts/ApexDollar.sol</code> on Base.</p>}
  {configured && !APXD_TREASURY_ADDRESS && <p className="text-xs text-amber-300/80">Set <code>NEXT_PUBLIC_APXD_TREASURY_ADDRESS</code> to the existing wallet that controls minting. Mint sends to the configured treasury; transfers use the connected treasury signer.</p>}
  </section>;
}
