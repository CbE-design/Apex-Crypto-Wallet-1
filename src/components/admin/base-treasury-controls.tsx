'use client';

import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { APXD_ABI, APXD_ADDRESS, APXD_CHAIN_ID, APXD_CHAIN_NAME, APXD_DECIMALS, APXD_EXPLORER_URL, APXD_RPC_URL, isApxdConfigured } from '@/config/apxd';
import { USDT_ABI, USDT_ADDRESS, USDT_CHAIN_ID, USDT_CHAIN_NAME, USDT_EXPLORER_URL, USDT_RPC_URL } from '@/config/usdt';

const tokens = {
  APXD: { address: APXD_ADDRESS, abi: APXD_ABI, decimals: APXD_DECIMALS, chainId: APXD_CHAIN_ID, chainName: APXD_CHAIN_NAME, rpc: APXD_RPC_URL, explorer: APXD_EXPLORER_URL },
  USDT: { address: USDT_ADDRESS, abi: USDT_ABI, decimals: 6, chainId: USDT_CHAIN_ID, chainName: USDT_CHAIN_NAME, rpc: USDT_RPC_URL, explorer: USDT_EXPLORER_URL },
} as const;

type TokenSymbol = keyof typeof tokens;

export function BaseTreasuryControls() {
  const { toast } = useToast();
  const [account, setAccount] = useState('');
  const [balances, setBalances] = useState<Record<TokenSymbol, string>>({ APXD: '0', USDT: '0' });
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<TokenSymbol>('USDT');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (address: string) => {
    if (!ethers.isAddress(address)) return;
    const next = { APXD: '0', USDT: '0' };
    for (const symbol of Object.keys(tokens) as TokenSymbol[]) {
      const token = tokens[symbol];
      try {
        const provider = new ethers.JsonRpcProvider(token.rpc, { name: token.chainName, chainId: Number(token.chainId) });
        const contract = new ethers.Contract(token.address, token.abi, provider);
        next[symbol] = ethers.formatUnits(await contract.balanceOf(address), token.decimals);
      } catch { next[symbol] = 'Unavailable'; }
    }
    setBalances(next);
  }, []);

  const connect = async () => {
    if (!window.ethereum) { toast({ title: 'MetaMask required', description: 'Install MetaMask to connect the treasury wallet.', variant: 'destructive' }); return; }
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const next = accounts?.[0] || '';
      setAccount(next);
      if (next) await refresh(next);
    } catch (error) { toast({ title: 'Connection failed', description: error instanceof Error ? error.message : 'MetaMask could not connect.', variant: 'destructive' }); }
  };

  useEffect(() => { if (account) void refresh(account); }, [account, refresh]);

  const watch = async (symbol: TokenSymbol) => {
    if (!window.ethereum) return;
    const token = tokens[symbol];
    const added = await window.ethereum.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: token.address, symbol, decimals: token.decimals } } });
    toast({ title: added ? `${symbol} added to MetaMask` : `${symbol} not added`, description: token.address });
  };

  const send = async () => {
    if (!window.ethereum || !ethers.isAddress(recipient) || !amount || !account) return;
    setBusy(true);
    try {
      const token = tokens[asset];
      const provider = new ethers.BrowserProvider(window.ethereum as never);
      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(token.chainId)) throw new Error('MetaMask must be connected to Base Mainnet.');
      const signer = await provider.getSigner();
      if ((await signer.getAddress()).toLowerCase() !== account.toLowerCase()) throw new Error('Connected account changed.');
      const contract = new ethers.Contract(token.address, token.abi, signer);
      const tx = await contract.transfer(recipient, ethers.parseUnits(amount, token.decimals));
      await tx.wait(1);
      toast({ title: `${asset} sent`, description: `${amount} ${asset} sent to ${recipient.slice(0, 8)}…`, action: <a className="text-xs underline" target="_blank" rel="noreferrer" href={`${token.explorer}/tx/${tx.hash}`}>View transaction</a> });
      setAmount(''); await refresh(account);
    } catch (error) { toast({ title: 'Transfer failed', description: error instanceof Error ? error.message : 'MetaMask rejected the transfer.', variant: 'destructive' }); } finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03] p-5 space-y-4">
    <div><p className="text-sm font-bold text-white">Base token treasury</p><p className="text-xs leading-5 text-white/45">Connect the treasury signer on Base, read live ERC-20 balances, add tokens to MetaMask, or send to an Apex or external wallet.</p></div>
    <Button onClick={() => void connect()}>{account ? `${account.slice(0, 8)}…${account.slice(-6)}` : 'Connect treasury MetaMask'}</Button>
    <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(tokens) as TokenSymbol[]).map(symbol => <div key={symbol} className="rounded-xl border border-white/[0.08] p-3"><div className="flex items-center justify-between"><span className="font-bold text-white">{symbol}</span><Button size="sm" variant="outline" onClick={() => void watch(symbol)}>Watch asset</Button></div><p className="mt-2 font-mono text-sm text-white/70">{balances[symbol]}</p><p className="mt-1 break-all text-[10px] text-white/35">{tokens[symbol].address}</p></div>)}</div>
    <div className="grid gap-3 sm:grid-cols-[120px_1fr_160px_auto] sm:items-end"><div><Label className="text-xs text-white/55">Asset</Label><select value={asset} onChange={event => setAsset(event.target.value as TokenSymbol)} className="mt-1 h-10 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white"><option value="USDT">USDT</option><option value="APXD" disabled={!isApxdConfigured()}>APXD</option></select></div><div><Label htmlFor="treasury-recipient" className="text-xs text-white/55">Recipient</Label><Input id="treasury-recipient" value={recipient} onChange={event => setRecipient(event.target.value)} placeholder="0x…" /></div><div><Label htmlFor="treasury-amount" className="text-xs text-white/55">Amount</Label><Input id="treasury-amount" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /></div><Button onClick={() => void send()} disabled={busy || !account || !recipient || !amount}>{busy ? 'Confirming…' : 'Send on Base'}</Button></div>
  </section>;
}
