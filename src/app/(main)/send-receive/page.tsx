
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowRight, Copy, ExternalLink, Loader2, ShieldCheck, Send, ArrowDownToLine, QrCode } from 'lucide-react';
import { RiskDisclaimer } from '@/components/risk-disclaimer';
import { CryptoIcon } from '@/components/crypto-icon';
import { useWallet } from '@/context/wallet-context';
import Image from 'next/image';
import { PrivateRoute } from '@/components/private-route';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { addDoc, collection, query, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { marketCoins } from '@/lib/data';
import { useCurrency } from '@/context/currency-context';
import { ethers } from 'ethers';
import { getSepoliaProvider, getSepoliaTransactionUrl, SEPOLIA_CHAIN_ID } from '@/lib/sepolia';

const sendSchema = z.object({
  recipientAddress: z.string().min(1, "Recipient address is required."),
  amount: z.string().refine(val => parseFloat(val) > 0, {
    message: "Amount must be greater than zero.",
  }),
  asset: z.string().min(1, "Please select an asset."),
  complianceId: z.string().optional(),
});

type SendFormValues = z.infer<typeof sendSchema>;
type SendMode = 'internal' | 'external';

type OnchainReceipt = {
  hash: string;
  blockNumber: number | null;
  amount: string;
  recipient: string;
};

export default function SendReceivePage() {
  const { toast } = useToast();
  const { wallet, user } = useWallet();
  const { currency, formatCurrency, rates } = useCurrency();
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const paramCurrency = searchParams.get('currency');
  const paramAction = searchParams.get('action');
  const initialAsset = paramCurrency && marketCoins.some(c => c.symbol === paramCurrency) ? paramCurrency : 'ETH';
  const initialTab = paramAction === 'receive' ? 'receive' : 'send';

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(initialAsset);
  const [sendMode, setSendMode] = useState<SendMode>('internal');
  const [isComplianceRequired, setIsComplianceRequired] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sepoliaBalance, setSepoliaBalance] = useState(0);
  const [isSepoliaBalanceLoading, setIsSepoliaBalanceLoading] = useState(false);
  const [onchainReceipt, setOnchainReceipt] = useState<OnchainReceipt | null>(null);

  const userAddress = wallet?.address || '...';
  
  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);
  
  const { data: userWallets } = useCollection(walletsQuery);

  const selectedAssetBalance = useMemo(() => {
    if (!userWallets) return 0;
    const w = userWallets.find(w => w.currency === selectedAsset);
    return w ? w.balance : 0;
  }, [userWallets, selectedAsset]);

  useEffect(() => {
    if (sendMode !== 'external' || !wallet?.address) return;

    let cancelled = false;
    const refreshBalance = async () => {
      setIsSepoliaBalanceLoading(true);
      try {
        const balance = await getSepoliaProvider().getBalance(wallet.address);
        if (!cancelled) setSepoliaBalance(Number(ethers.formatEther(balance)));
      } catch (error) {
        console.warn('[sepolia] Could not read testnet balance:', error);
        if (!cancelled) setSepoliaBalance(0);
      } finally {
        if (!cancelled) setIsSepoliaBalanceLoading(false);
      }
    };

    refreshBalance();
    const interval = window.setInterval(refreshBalance, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sendMode, wallet?.address]);

  const { 
      register, 
      handleSubmit, 
      formState: { errors, isValid, isSubmitting },
      watch,
      reset,
      setValue
  } = useForm<SendFormValues>({
      resolver: zodResolver(sendSchema),
      defaultValues: { recipientAddress: '', amount: '', asset: initialAsset },
      mode: 'onChange',
  });

  const formValues = watch();

  const [liveAssetPriceUSD, setLiveAssetPriceUSD] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!selectedAsset) return;
    fetch(`/api/prices?symbols=${selectedAsset}&currency=USD`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Price fetch failed')))
      .then(({ prices }: { prices: Record<string, number> }) => {
        setLiveAssetPriceUSD(prev => ({ ...prev, [selectedAsset]: prices[selectedAsset] || 0 }));
      })
      .catch(() => {});
  }, [selectedAsset]);

  useEffect(() => {
    const amountVal = parseFloat(formValues.amount) || 0;
    const assetPriceUSD = liveAssetPriceUSD[selectedAsset] || (selectedAsset === 'ETH' ? 2000 : selectedAsset === 'BTC' ? 82000 : 1);
    const zarRate = rates.ZAR || 18.62;
    const valueInZAR = amountVal * assetPriceUSD * zarRate;
    setIsComplianceRequired(valueInZAR > 3000);
  }, [formValues.amount, selectedAsset, liveAssetPriceUSD, rates]);

  useEffect(() => {
    if (wallet?.address) {
      QRCode.toDataURL(wallet.address, { errorCorrectionLevel: 'H', width: 250 })
        .then(setQrCodeDataUrl)
        .catch(err => {
            console.error('Failed to generate QR code', err);
            setQrCodeDataUrl('');
        });
    }
  }, [wallet?.address]);

  const executeSend = async (data: SendFormValues) => {
    if (!wallet || !user || isSending) return;
    setIsSending(true);

    if (data.recipientAddress.toLowerCase() === userAddress.toLowerCase()) {
      toast({ title: 'Invalid Recipient', description: 'You cannot send to your own address.', variant: 'destructive' });
      setIsSending(false);
      return;
    }

    try {
      if (sendMode === 'external') {
        if (data.asset !== 'ETH') {
          throw new Error('Sepolia external sends currently support native ETH only.');
        }
        if (!ethers.isAddress(data.recipientAddress)) {
          throw new Error('Enter a valid Ethereum wallet address beginning with 0x.');
        }

        const provider = getSepoliaProvider();
        const network = await provider.getNetwork();
        if (network.chainId !== BigInt(SEPOLIA_CHAIN_ID)) {
          throw new Error('The Sepolia network could not be verified.');
        }

        const amountWei = ethers.parseEther(data.amount);
        const currentBalance = await provider.getBalance(wallet.address);
        const feeData = await provider.getFeeData();
        const estimatedGas = await provider.estimateGas({
          from: wallet.address,
          to: data.recipientAddress,
          value: amountWei,
        });
        const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
        const estimatedFee = gasPrice ? estimatedGas * gasPrice : 0n;

        if (currentBalance < amountWei + estimatedFee) {
          throw new Error('Insufficient Sepolia ETH for the amount plus network fee. Get testnet ETH from a Sepolia faucet.');
        }

        // The private key never leaves the browser. This is a direct,
        // self-custodial transaction signed by the unlocked local wallet.
        const signer = new ethers.Wallet(wallet.privateKey, provider);
        const tx = await signer.sendTransaction({
          to: data.recipientAddress,
          value: amountWei,
        });
        const receipt = await tx.wait(1);
        if (!receipt || receipt.status !== 1) {
          throw new Error('The Sepolia transaction was reverted and no funds were sent.');
        }
        const explorerUrl = getSepoliaTransactionUrl(tx.hash);

        if (firestore) {
          try {
            await addDoc(collection(firestore, 'users', user.uid, 'transactions'), {
              userId: user.uid,
              type: 'Transfer Sent',
              currency: 'ETH',
              amount: Number(data.amount),
              price: 0,
              status: 'Completed',
              timestamp: serverTimestamp(),
              sender: wallet.address,
              recipient: data.recipientAddress,
              description: `Sent ${data.amount} ETH on Ethereum Sepolia`,
              notes: 'Publicly verifiable Sepolia testnet transfer',
              txHash: tx.hash,
              metadata: {
                protocol: 'ETHEREUM_SEPOLIA_EXTERNAL_TRANSFER',
                network: 'sepolia',
                chainId: SEPOLIA_CHAIN_ID,
                explorerUrl,
              },
            });
          } catch (historyError) {
            // A confirmed blockchain transaction remains successful even if
            // the optional local history write is unavailable.
            console.warn('[sepolia] Transaction confirmed but history write failed:', historyError);
          }
        }

        setOnchainReceipt({
          hash: tx.hash,
          blockNumber: receipt?.blockNumber ?? null,
          amount: data.amount,
          recipient: data.recipientAddress,
        });
        setSepoliaBalance(Number(ethers.formatEther(await provider.getBalance(wallet.address))));
        toast({
          title: 'Sepolia Transfer Confirmed',
          description: 'The transaction is now publicly verifiable on Etherscan.',
        });
      } else {
        // Get the user's Firebase ID token to authenticate the server-side transfer
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('Not authenticated. Please reconnect your wallet.');

        const res = await fetch('/api/transfer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            recipientAddress: data.recipientAddress,
            asset: data.asset,
            amount: parseFloat(data.amount),
            complianceId: data.complianceId,
            travelRuleVerified: isComplianceRequired,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Transfer failed.');

        toast({ title: 'Transfer Complete', description: `Successfully sent ${data.amount} ${data.asset}.` });
      }

      reset({ asset: sendMode === 'external' ? 'ETH' : selectedAsset, amount: '', recipientAddress: '' });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      toast({ title: 'Transfer Failed', description: message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <PrivateRoute>
      <div className="flex justify-center items-start pt-2">
        <div className="w-full max-w-lg space-y-4">
        <RiskDisclaimer variant="transfer" collapsible />
        <div className="rounded-[28px] border border-white/[0.08] bg-[#0A0C12]/90 backdrop-blur-xl overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 to-violet-500" />
          <div className="px-6 pt-7 pb-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <Send className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Send & Receive</h2>
                <p className="text-xs text-white/30">Transfer crypto to any Apex wallet</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-6">
            <Tabs defaultValue={initialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/[0.04] rounded-xl p-1 h-11 border border-white/[0.06]">
                <TabsTrigger value="send" className="rounded-lg text-sm font-medium data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-500/25">Send</TabsTrigger>
                <TabsTrigger value="receive" className="rounded-lg text-sm font-medium data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-300 data-[state=active]:border data-[state=active]:border-violet-500/25">Receive</TabsTrigger>
              </TabsList>
               <TabsContent value="send" className="pt-6 space-y-5">
                 <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
                   <button
                     type="button"
                     onClick={() => setSendMode('internal')}
                     className={`rounded-lg px-3 py-2.5 text-left transition-all ${
                       sendMode === 'internal'
                         ? 'bg-cyan-500/15 border border-cyan-500/25'
                         : 'border border-transparent hover:bg-white/[0.04]'
                     }`}
                   >
                     <p className={`text-xs font-semibold ${sendMode === 'internal' ? 'text-cyan-300' : 'text-white/60'}`}>
                       Apex wallet
                     </p>
                     <p className="mt-0.5 text-[10px] text-white/30">Instant internal ledger transfer</p>
                   </button>
                   <button
                     type="button"
                     onClick={() => {
                       setSendMode('external');
                       setSelectedAsset('ETH');
                       setValue('asset', 'ETH', { shouldValidate: true });
                     }}
                     className={`rounded-lg px-3 py-2.5 text-left transition-all ${
                       sendMode === 'external'
                         ? 'bg-violet-500/15 border border-violet-500/25'
                         : 'border border-transparent hover:bg-white/[0.04]'
                     }`}
                   >
                     <p className={`text-xs font-semibold ${sendMode === 'external' ? 'text-violet-300' : 'text-white/60'}`}>
                       External wallet
                     </p>
                     <p className="mt-0.5 text-[10px] text-white/30">Public Ethereum Sepolia testnet</p>
                   </button>
                 </div>

                 {sendMode === 'external' && (
                   <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3.5 space-y-1.5">
                     <div className="flex items-center gap-2 text-violet-300">
                       <ExternalLink className="h-3.5 w-3.5" />
                       <span className="text-xs font-semibold">On-chain testnet transfer</span>
                     </div>
                     <p className="text-[10px] leading-relaxed text-white/40">
                       Sends native ETH on Ethereum Sepolia. Your Firestore virtual balance is not used.
                       You need Sepolia ETH for the amount and gas.
                     </p>
                   </div>
                 )}

                <form onSubmit={e => e.preventDefault()} className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Asset</Label>
                         <Select
                           value={selectedAsset}
                           disabled={sendMode === 'external'}
                           onValueChange={(val) => { setSelectedAsset(val); setValue('asset', val, { shouldValidate: true }); }}
                         >
                            <SelectTrigger className="h-12 bg-white/[0.04] border-white/[0.08] rounded-xl">
                                <SelectValue placeholder="Select cryptocurrency" />
                            </SelectTrigger>
                            <SelectContent>
                                {marketCoins.map(coin => (
                                    <SelectItem key={coin.symbol} value={coin.symbol}>
                                        <div className="flex items-center gap-2">
                                            <CryptoIcon name={coin.name} className="h-4 w-4" />
                                            {coin.name} ({coin.symbol})
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                         <Label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                           {sendMode === 'external' ? 'External Ethereum Address' : 'Recipient Address'}
                         </Label>
                         <Input
                           className="h-12 bg-white/[0.04] border-white/[0.08] rounded-xl font-mono text-sm"
                           placeholder="0x..."
                           {...register('recipientAddress')}
                         />
                        {errors.recipientAddress && <p className="text-xs text-red-400">{errors.recipientAddress.message}</p>}
                         {sendMode === 'external' && (
                           <p className="text-[10px] text-white/30">Use a Sepolia-compatible 0x address. ENS and email recipients are not supported.</p>
                         )}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Amount</Label>
                        <div className="relative">
                            <Input className="h-14 bg-white/[0.04] border-white/[0.08] rounded-xl text-lg font-semibold pr-16" type="number" step="any" placeholder="0.00" {...register('amount')} />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-cyan-400">{selectedAsset}</div>
                        </div>
                         <p className="text-[10px] text-white/30">
                             Available: <span className="text-white/60 font-semibold">
                               {sendMode === 'external'
                                 ? isSepoliaBalanceLoading
                                   ? 'Checking Sepolia…'
                                   : `${sepoliaBalance.toFixed(6)} ETH`
                                 : `${(selectedAssetBalance ?? 0).toFixed(6)} ${selectedAsset}`}
                             </span>
                        </p>
                        {errors.amount && <p className="text-xs text-red-400">{errors.amount.message}</p>}
                    </div>

                    {isComplianceRequired && (
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3 animate-in fade-in zoom-in-95">
                            <div className="flex items-center gap-2 text-amber-400">
                                <ShieldCheck className="h-4 w-4" />
                                <span className="text-xs font-semibold">Additional Verification Required</span>
                            </div>
                            <p className="text-xs text-white/30">This transfer exceeds the threshold for additional verification. A compliance reference will be generated automatically.</p>
                            <Input className="h-10 bg-white/[0.04] border-white/[0.07] rounded-lg text-xs font-mono" placeholder="Compliance ID (optional)" {...register('complianceId')} />
                        </div>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button type="button" className="w-full h-12 rounded-xl btn-premium font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40" disabled={!isValid || isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                                {isSubmitting ? "Sending..." : "Send"}
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/60">
                            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px] bg-gradient-to-r from-cyan-500 to-violet-500" />
                            <AlertDialogHeader>
                                 <AlertDialogTitle className="text-white font-bold">
                                   {sendMode === 'external' ? 'Confirm Sepolia Transfer' : 'Confirm Transfer'}
                                 </AlertDialogTitle>
                                <AlertDialogDescription className="text-white/30">
                                     {sendMode === 'external'
                                       ? 'This creates a real, irreversible Sepolia blockchain transaction.'
                                       : 'Please review the details below. This transfer cannot be reversed.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="py-2 space-y-2">
                                <div className="flex justify-between items-center bg-white/[0.03] p-4 rounded-xl border border-white/[0.06]">
                                    <span className="text-[10px] font-semibold text-white/30 uppercase">Amount</span>
                                     <span className="font-bold text-lg text-cyan-400">{formValues.amount} {selectedAsset}</span>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-white/25 uppercase">Recipient</p>
                                    <p className="text-xs font-mono break-all bg-white/[0.03] p-3 rounded-xl border border-white/[0.06] text-white/50">{formValues.recipientAddress}</p>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl border-white/10 bg-white/[0.04] text-white/40" disabled={isSending}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmit(executeSend)} className="rounded-xl btn-cyan" disabled={isSending}>
                                     {isSending ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Sending...</> : 'Confirm & Send'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                     {onchainReceipt && sendMode === 'external' && (
                       <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                         <div className="flex items-center gap-2">
                           <div className="h-2 w-2 rounded-full bg-emerald-400" />
                           <p className="text-xs font-semibold text-emerald-300">Transaction publicly verified</p>
                         </div>
                         <div className="space-y-1.5 text-[10px]">
                           <div className="flex justify-between gap-3">
                             <span className="text-white/35">Amount</span>
                             <span className="font-mono text-white/70">{onchainReceipt.amount} ETH</span>
                           </div>
                           <div className="flex justify-between gap-3">
                             <span className="text-white/35">Block</span>
                             <span className="font-mono text-white/70">{onchainReceipt.blockNumber ?? 'Pending index'}</span>
                           </div>
                           <div className="flex justify-between gap-3">
                             <span className="text-white/35">Hash</span>
                             <span className="font-mono text-white/50 truncate max-w-[230px]">{onchainReceipt.hash}</span>
                           </div>
                         </div>
                         <a
                           href={getSepoliaTransactionUrl(onchainReceipt.hash)}
                           target="_blank"
                           rel="noreferrer"
                           className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
                         >
                           View on Sepolia Etherscan <ExternalLink className="h-3 w-3" />
                         </a>
                       </div>
                     )}
                  </form>
              </TabsContent>
              <TabsContent value="receive" className="pt-6 space-y-5">
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Your Wallet Address</p>
                        <div className="w-full p-3 bg-white/[0.04] border border-white/[0.07] rounded-xl flex items-center gap-3">
                            <code className="text-xs font-mono break-all flex-1 text-center text-white/50">{userAddress}</code>
                            <button className="h-8 w-8 rounded-lg bg-white/[0.05] hover:bg-white/10 flex items-center justify-center flex-shrink-0 transition-all" onClick={() => { navigator.clipboard.writeText(userAddress); toast({ title: 'Address Copied' }); }}>
                                <Copy className="h-4 w-4 text-white/30" />
                            </button>
                        </div>
                    </div>
                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="w-full h-12 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/50 hover:text-white/70 font-semibold text-sm flex items-center justify-center gap-2 transition-all">
                                <QrCode className="h-4 w-4" />
                                Show QR Code
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xs border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px]">
                            <DialogHeader>
                                <DialogTitle className="text-center text-lg font-bold text-white">Receive Crypto</DialogTitle>
                                <DialogDescription className="sr-only">Scan the QR code to send crypto to this wallet.</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="p-4 bg-white rounded-2xl shadow-lg">
                                    {qrCodeDataUrl ? <Image src={qrCodeDataUrl} alt="Deposit QR Code" width={200} height={200} className="rounded-lg" /> : <Loader2 className="animate-spin h-8 w-8 text-gray-400" />}
                                </div>
                                <div className="w-full p-3 bg-white/[0.04] border border-white/[0.07] rounded-xl">
                                    <code className="text-[11px] font-mono break-all block text-center text-white/50">{userAddress}</code>
                                </div>
                                <button className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/50 font-semibold flex items-center justify-center gap-2 transition-all" onClick={() => { navigator.clipboard.writeText(userAddress); toast({ title: 'Address Copied' }); }}>
                                    <Copy className="h-4 w-4" /> Copy Address
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <p className="text-xs text-white/25 text-center">
                        Share your address or QR code to receive crypto from other Apex wallets.
                    </p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <p className="text-[10px] text-center text-white/15 px-2">
          Blockchain transfers are final and irreversible — always double-check the recipient address.
          By transacting you accept our{' '}
          <a href="/legal/terms" className="underline hover:text-white/30 transition-colors">Terms</a> and{' '}
          <a href="/legal/risk-disclosure" className="underline hover:text-white/30 transition-colors">Risk Disclosure</a>.
        </p>
        </div>
      </div>
    </PrivateRoute>
  );
}
