'use client';

import { useState, useMemo, useCallback } from 'react';
import { useWallet } from '@/context/wallet-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, type Firestore } from 'firebase/firestore';
import { useCurrency } from '@/context/currency-context';
import { useLivePrices } from '@/hooks/use-live-prices';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  BITREFILL_PRODUCTS,
  CATEGORY_CONFIG,
  type BitrefillCategory,
  type BitrefillProduct,
  type BitrefillDenomination,
} from '@/lib/bitrefill-data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Zap,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  Shield,
  TrendingUp,
  Flame,
  Star,
  Globe,
  Info,
  Loader2,
  CreditCard,
  ShoppingBag,
  ArrowLeft,
} from 'lucide-react';
import { CryptoIcon } from '@/components/crypto-icon';
import { PrivateRoute } from '@/components/private-route';
import { RiskDisclaimer } from '@/components/risk-disclaimer';

// ── Reference prices (fallback when the live feed is unavailable) ──────────────
const FALLBACK_PRICES: Record<string, number> = {
  BTC: 82000, ETH: 2400, BNB: 590, USDT: 1, USDC: 1,
  SOL: 155, ADA: 0.42, LINK: 13.5, MATIC: 0.52,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFiat(amount: number, currency: string) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Real brand logos installed from theSVG.org (public/brand-logos/{id}.svg) ────
// Each product id in this set has an authentic, full brand logo bundled locally.
const PRODUCTS_WITH_LOGOS = new Set<string>([
  'netflix', 'spotify', 'disney-plus', 'apple-tv', 'youtube-premium',
  'playstation', 'xbox', 'steam', 'nintendo', 'roblox', 'valorant',
  'amazon', 'google-play', 'apple-itunes', 'uber', 'uber-eats',
  'kfc', 'mcdonalds', 'starbucks', 'airbnb', 'booking',
]);

// The international flag shown on a product is derived from the currency the
// product is denominated in (public/flags/{code}.svg).
const CURRENCY_FLAG: Record<string, { code: string; label: string }> = {
  ZAR: { code: 'za', label: 'South Africa' },
  USD: { code: 'us', label: 'United States' },
  GBP: { code: 'gb', label: 'United Kingdom' },
  EUR: { code: 'eu', label: 'European Union' },
};

// ── Brand Logo Card ───────────────────────────────────────────────────────────
function BrandLogo({ product, size = 'md' }: { product: BitrefillProduct; size?: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 'h-14', md: 'h-20', lg: 'h-28' };
  const textSizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };
  const logoHeights = { sm: 'h-4', md: 'h-6', lg: 'h-9' };
  const chipPad = { sm: 'px-2.5 py-1.5', md: 'px-3.5 py-2.5', lg: 'px-5 py-3.5' };
  const logoMaxW = { sm: 'max-w-[64px]', md: 'max-w-[104px]', lg: 'max-w-[150px]' };
  const flagSize = { sm: 'w-4', md: 'w-5', lg: 'w-6' };

  const hasLogo = PRODUCTS_WITH_LOGOS.has(product.id);
  const flag = CURRENCY_FLAG[product.denominations[0]?.currency ?? ''];

  return (
    <div
      className={cn('w-full flex items-center justify-center relative overflow-hidden', heights[size])}
      style={{ background: product.brandGradient }}
    >
      {/* Subtle noise overlay */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        }}
      />

      {hasLogo ? (
        <div className={cn('relative z-10 flex items-center justify-center rounded-xl bg-white shadow-lg shadow-black/25 ring-1 ring-black/5', chipPad[size])}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/brand-logos/${product.id}.svg`}
            alt={`${product.fullName} logo`}
            className={cn('w-auto object-contain', logoHeights[size], logoMaxW[size])}
            loading="lazy"
          />
        </div>
      ) : (
        <span
          className={cn('font-black tracking-tight select-none relative z-10', textSizes[size])}
          style={{ color: product.textColor, textShadow: product.textColor === '#FFFFFF' ? '0 1px 8px rgba(0,0,0,0.4)' : 'none' }}
        >
          {product.abbrev}
        </span>
      )}

      {/* Country flag — derived from the product's currency */}
      {flag && (
        <div className="absolute top-2 left-2 z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/flags/${flag.code}.svg`}
            alt={`${flag.label} flag`}
            title={flag.label}
            className={cn('h-auto rounded-[3px] shadow-md ring-1 ring-black/25 object-cover', flagSize[size])}
            loading="lazy"
          />
        </div>
      )}

      {product.saFeatured && size !== 'sm' && (
        <div className="absolute top-2 right-2 z-10">
          <span className="text-[8px] font-black uppercase bg-black/30 text-white/90 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            SA
          </span>
        </div>
      )}
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, onClick }: { product: BitrefillProduct; onClick: () => void }) {
  const minDenom = product.denominations[0];
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl overflow-hidden border border-white/[0.07] bg-[#0A0C12]/80 hover:border-white/[0.18] hover:scale-[1.025] transition-all duration-200 hover:shadow-lg hover:shadow-black/40"
    >
      <BrandLogo product={product} size="md" />
      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-[12px] font-black text-white truncate leading-tight">{product.name}</p>
            <p className="text-[9px] text-white/35 mt-0.5 truncate font-medium uppercase tracking-wider">
              from {formatFiat(minDenom.value, minDenom.currency)}
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-white/20 flex-shrink-0 mt-0.5 group-hover:text-primary/60 transition-colors" />
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/[0.05] text-white/30 border border-white/[0.06]">
            {product.processingTime}
          </span>
          {product.tag && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary/70 border border-primary/20">
              {product.tag}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Purchase Modal ────────────────────────────────────────────────────────────
function PurchaseModal({
  product,
  onClose,
  userWallets,
  rates,
  livePrices,
  firestore,
  userId,
}: {
  product: BitrefillProduct;
  onClose: () => void;
  userWallets: any[];
  rates: Record<string, number>;
  livePrices: Record<string, number>;
  firestore: Firestore | null;
  userId: string | undefined;
}) {
  const { toast } = useToast();
  const [selectedDenom, setSelectedDenom] = useState<BitrefillDenomination>(product.denominations[0]);
  const [selectedCrypto, setSelectedCrypto] = useState<string>(
    userWallets.find((w: any) => (w.balance ?? 0) > 0)?.currency ?? ''
  );
  const [recipientInfo, setRecipientInfo] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderId: string; code: string } | null>(null);
  const [comingSoon, setComingSoon] = useState(false);

  // Needs recipient input for airtime
  const needsRecipient = product.category === 'airtime';
  const recipientLabel = 'Mobile Number';
  const recipientPlaceholder = '+27 81 234 5678';

  // Calculate crypto cost
  const cryptoCost = useMemo(() => {
    const selectedWallet = userWallets.find((w: any) => w.currency === selectedCrypto);
    if (!selectedWallet) return null;
    const zarRate = rates?.ZAR ?? 18.62;
    const usdRate = 1;
    let denomValueUSD = 0;
    if (selectedDenom.currency === 'ZAR') {
      denomValueUSD = selectedDenom.value / zarRate;
    } else if (selectedDenom.currency === 'USD') {
      denomValueUSD = selectedDenom.value;
    } else if (selectedDenom.currency === 'EUR') {
      denomValueUSD = selectedDenom.value / (rates?.EUR ? 1 / rates.EUR : 0.92);
    }
    // Prefer live prices from the market feed; fall back to reference prices.
    const priceUSD = livePrices[selectedCrypto] ?? FALLBACK_PRICES[selectedCrypto] ?? 1;
    return {
      amount: denomValueUSD / priceUSD,
      priceUSD,
      symbol: selectedCrypto,
      balance: selectedWallet.balance ?? 0,
    };
  }, [selectedDenom, selectedCrypto, userWallets, rates, livePrices]);

  const hasEnoughBalance = cryptoCost ? cryptoCost.balance >= cryptoCost.amount : false;
  const canProceed = !!selectedCrypto && hasEnoughBalance && (!needsRecipient || recipientInfo.trim().length >= 7);

  const handlePlaceOrder = useCallback(() => {
    if (!canProceed) return;
    setConfirmOpen(true);
  }, [canProceed]);

  const handleConfirmOrder = useCallback(async () => {
    if (!cryptoCost) {
      toast({ title: 'Cannot process order', description: 'Session expired. Please sign in again.', variant: 'destructive' });
      return;
    }
    setConfirmOpen(false);
    setIsProcessing(true);

    // Run the checkout flow right up to the payment step so the experience feels
    // real, then stop before any balance is spent — this feature is launching soon.
    await new Promise((resolve) => setTimeout(resolve, 1600));

    setIsProcessing(false);
    setComingSoon(true);
  }, [cryptoCost, toast]);

  // ── Coming soon screen ────────────────────────────────────────────────────
  if (comingSoon) {
    return (
      <div className="flex flex-col items-center text-center space-y-5 py-4">
        <div className="h-16 w-16 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
          <Clock className="h-8 w-8 text-amber-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">Coming Soon</h3>
          <p className="text-xs text-white/50 mt-1 leading-relaxed max-w-[16rem]">
            Purchases aren&apos;t live just yet. Your balance was not charged — checkout will be enabled here shortly.
          </p>
        </div>

        <div className="w-full space-y-2 text-sm">
          {[
            ['Product', product.fullName],
            ['Amount', formatFiat(selectedDenom.value, selectedDenom.currency)],
            ['Pay With', selectedCrypto || '—'],
            ['Delivery', product.deliveryMethod],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center text-xs">
              <span className="text-white/40">{label}</span>
              <span className="font-bold text-white text-right max-w-[60%] truncate">{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full h-11 rounded-xl border border-white/[0.1] text-[11px] font-black uppercase tracking-wider text-white/60 hover:border-primary/30 hover:text-white/80 transition-all"
        >
          Close
        </button>
      </div>
    );
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (orderSuccess) {
    return (
      <div className="flex flex-col items-center text-center space-y-5 py-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center glow-violet">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">Order Complete!</h3>
          <p className="text-xs text-white/50 mt-1">Your {product.name} voucher has been delivered</p>
        </div>

        <div className="w-full bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3 text-left">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Redemption Code</p>
          <div className="font-mono text-lg font-black text-white tracking-[0.2em] text-center py-2 bg-primary/10 border border-primary/20 rounded-xl">
            {orderSuccess.code}
          </div>
          <p className="text-[9px] text-white/30 text-center">Tap to copy · Also sent to your email</p>
        </div>

        <div className="w-full space-y-2 text-sm">
          {[
            ['Product', product.fullName],
            ['Amount', formatFiat(selectedDenom.value, selectedDenom.currency)],
            ['Order ID', orderSuccess.orderId],
            ['Delivery', product.deliveryMethod],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center text-xs">
              <span className="text-white/40">{label}</span>
              <span className="font-bold text-white text-right max-w-[60%] truncate">{value}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-white/30 leading-relaxed">{product.termsNote}</p>

        <button
          onClick={onClose}
          className="w-full h-11 rounded-xl border border-white/[0.1] text-[11px] font-black uppercase tracking-wider text-white/60 hover:border-primary/30 hover:text-white/80 transition-all"
        >
          Close
        </button>
      </div>
    );
  }

  // ── Processing screen ───────────────────────────────────────────────────────
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center text-center space-y-5 py-8">
        <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">Processing Order</h3>
          <p className="text-xs text-white/50 mt-1">Confirming your crypto payment and fetching voucher…</p>
        </div>
        <div className="w-full space-y-2.5">
          {['Verifying crypto balance', 'Processing payment', 'Fetching voucher code', 'Sending to email'].map((step, i) => (
            <div key={step} className={cn('flex items-center gap-3 text-xs transition-all', i === 1 ? 'text-white' : 'text-white/30')}>
              {i === 1 ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" /> : i < 1 ? <CheckCircle2 className="h-3.5 w-3.5 text-accent flex-shrink-0" /> : <div className="h-3.5 w-3.5 rounded-full border border-white/20 flex-shrink-0" />}
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Product header */}
      <div className="rounded-2xl overflow-hidden">
        <BrandLogo product={product} size="lg" />
      </div>

      <div>
        <h3 className="text-sm font-black text-white">{product.fullName}</h3>
        <p className="text-xs text-white/45 mt-1 leading-relaxed">{product.description}</p>
      </div>

      {/* Denomination picker */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/35">Select Amount</p>
        <div className="grid grid-cols-3 gap-2">
          {product.denominations.map((denom) => (
            <button
              key={denom.label}
              onClick={() => setSelectedDenom(denom)}
              className={cn(
                'h-11 rounded-xl text-xs font-black border transition-all duration-150',
                selectedDenom.label === denom.label
                  ? 'border-primary/50 bg-primary/15 text-white glow-violet'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-white/[0.18] hover:text-white/80'
              )}
            >
              {denom.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipient info (airtime only) */}
      {needsRecipient && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/35">{recipientLabel}</p>
          <input
            type="tel"
            value={recipientInfo}
            onChange={e => setRecipientInfo(e.target.value)}
            placeholder={recipientPlaceholder}
            className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/50 transition-all"
          />
          <p className="text-[9px] text-white/25">Airtime will be sent directly to this number</p>
        </div>
      )}

      {/* Pay with crypto */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/35">Pay With</p>
        {userWallets.filter((w: any) => (w.balance ?? 0) > 0).length === 0 ? (
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
            <p className="text-xs text-white/40">No crypto balance available. Fund your wallet first.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-auto scroll-container">
            {userWallets.filter((w: any) => (w.balance ?? 0) > 0).map((wallet: any) => {
              const isSelected = selectedCrypto === wallet.currency;
              return (
                <button
                  key={wallet.currency}
                  onClick={() => setSelectedCrypto(wallet.currency)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all',
                    isSelected
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]'
                  )}
                >
                  <CryptoIcon name={wallet.currency} className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-xs font-black text-white">{wallet.currency}</p>
                    <p className="text-[9px] text-white/35 tabular-nums">Balance: {Number(wallet.balance).toFixed(6)}</p>
                  </div>
                  {isSelected && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Order summary */}
      {cryptoCost && selectedCrypto && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/45">Amount</span>
            <span className="font-black text-white">{formatFiat(selectedDenom.value, selectedDenom.currency)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/45">You pay</span>
            <span className="font-mono font-black text-accent tabular-nums">
              {cryptoCost.amount.toFixed(8).replace(/\.?0+$/, '')} {selectedCrypto}
            </span>
          </div>
          <div className="neon-divider" />
          <div className="flex justify-between text-[10px]">
            <span className="text-white/30">Rate</span>
            <span className="text-white/40 tabular-nums">1 {selectedCrypto} = ${cryptoCost.priceUSD.toLocaleString()}</span>
          </div>
          {!hasEnoughBalance && (
            <p className="text-[10px] text-amber-400 flex items-center gap-1 font-bold">
              <Info className="h-3 w-3" /> Insufficient {selectedCrypto} balance
            </p>
          )}
        </div>
      )}

      {/* Meta info */}
      <div className="flex items-center justify-between text-[10px] text-white/25 px-0.5">
        <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{product.processingTime}</div>
        <div className="flex items-center gap-1"><Shield className="h-3 w-3" />Secured by Bitrefill</div>
        <div className="flex items-center gap-1"><Globe className="h-3 w-3" />Instant delivery</div>
      </div>

      {/* Buy button */}
      <button
        onClick={handlePlaceOrder}
        disabled={!canProceed}
        className="w-full h-12 rounded-xl btn-premium font-black text-sm text-white uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
      >
        <Zap className="h-4 w-4" />
        Buy Now · {formatFiat(selectedDenom.value, selectedDenom.currency)}
      </button>

      <p className="text-[9px] text-white/20 text-center leading-relaxed">{product.termsNote}</p>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm border-white/[0.08] bg-[#07090F]/95 backdrop-blur-3xl rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Confirm Purchase
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-white/50">
              You're about to purchase {product.name} ({selectedDenom.label}) using {selectedCrypto}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 space-y-2 my-1">
            {[
              ['Product', product.fullName],
              ['Value', formatFiat(selectedDenom.value, selectedDenom.currency)],
              ...(needsRecipient ? [['To', recipientInfo]] : []),
              ['Pay', `${cryptoCost?.amount.toFixed(8).replace(/\.?0+$/, '')} ${selectedCrypto}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-white/40">{k}</span>
                <span className="font-black text-white text-right max-w-[60%] truncate">{v}</span>
              </div>
            ))}
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11 text-[11px] font-black uppercase border-white/[0.1] bg-transparent flex-1">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmOrder(); }}
              className="btn-premium rounded-xl h-11 text-[11px] font-black uppercase text-white flex-1 border-0"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main Page ────────────────────���────────────────────────────────────────────
export default function BitrefillPage() {
  const { user } = useWallet();
  const { rates } = useCurrency();
  const firestore = useFirestore();

  const [activeCategory, setActiveCategory] = useState<BitrefillCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<BitrefillProduct | null>(null);

  const walletsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'wallets'));
  }, [user, firestore]);

  const { data: userWallets } = useCollection(walletsQuery);
  const wallets = userWallets ?? [];

  // Live market prices for every funded wallet — shared with the purchase modal
  // so quotes and the spendable balance both use the real feed.
  const walletSymbols = useMemo(
    () => [...new Set(wallets.filter((w: any) => (w.balance ?? 0) > 0).map((w: any) => w.currency as string))],
    [wallets]
  );
  const { prices: livePrices } = useLivePrices(walletSymbols);

  const totalBalanceUSD = useMemo(() => {
    return wallets.reduce(
      (acc: number, w: any) =>
        acc + ((w.balance ?? 0) * (livePrices[w.currency] ?? FALLBACK_PRICES[w.currency] ?? 0)),
      0
    );
  }, [wallets, livePrices]);

  const filteredProducts = useMemo(() => {
    let list = BITREFILL_PRODUCTS;
    if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const popularProducts = useMemo(() =>
    BITREFILL_PRODUCTS.filter(p => p.popular).slice(0, 6), []);

  const saProducts = useMemo(() =>
    BITREFILL_PRODUCTS.filter(p => p.saFeatured), []);

  const categories = Object.entries(CATEGORY_CONFIG) as [BitrefillCategory, typeof CATEGORY_CONFIG[BitrefillCategory]][];

  return (
    <PrivateRoute>
      <div className="container max-w-6xl py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #FF6600 0%, #FF9900 100%)' }}>
                <span className="text-base font-black text-white">B</span>
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-none">Bitrefill</h1>
                <p className="text-[10px] text-white/40 font-medium mt-0.5">
                  Live your life on crypto — vouchers, airtime, gift cards &amp; more
                </p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-amber-400/10 text-amber-400/90 border border-amber-400/20 ml-1">
                Coming Soon
              </span>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            {[
              { icon: Zap, label: 'Instant Delivery' },
              { icon: Shield, label: 'Secured & Private' },
              { icon: Globe, label: '170+ Countries' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="h-3 w-3" />
                <span className="font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Balance strip ──────────────────────────────────────────────── */}
        {wallets.filter((w: any) => (w.balance ?? 0) > 0).length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#0A0C12]/80 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Your Spendable Balance</p>
                <p className="text-2xl font-black text-white tabular-nums mt-0.5">
                  ${totalBalanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {wallets.filter((w: any) => (w.balance ?? 0) > 0).slice(0, 4).map((w: any) => (
                  <div key={w.currency} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <CryptoIcon name={w.currency} className="h-4 w-4" />
                    <span className="text-xs font-black text-white">{w.currency}</span>
                    <span className="text-[10px] text-white/40 tabular-nums">{Number(w.balance).toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products, brands, vouchers…"
            className="w-full h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] pl-11 pr-11 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-white/30 hover:text-white/60 transition-colors" />
            </button>
          )}
        </div>

        {/* ── Category tabs ──────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scroll-container">
          {categories.map(([key, config]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[11px] font-black transition-all border',
                activeCategory === key
                  ? 'bg-primary/15 border-primary/35 text-white shadow-sm shadow-primary/20'
                  : 'bg-white/[0.03] border-white/[0.07] text-white/45 hover:border-white/[0.14] hover:text-white/70'
              )}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
              {key !== 'all' && (
                <span className={cn('text-[9px] tabular-nums', activeCategory === key ? 'text-primary/70' : 'text-white/25')}>
                  {BITREFILL_PRODUCTS.filter(p => p.category === key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── No search results ───────────────────────────────────────────── */}
        {searchQuery && filteredProducts.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto">
              <Search className="h-6 w-6 text-white/20" />
            </div>
            <p className="text-sm font-black text-white/60">No results for "{searchQuery}"</p>
            <p className="text-xs text-white/30">Try a different search term or browse by category</p>
          </div>
        )}

        {/* ── SA Featured (only when on all / sa-vouchers and not searching) */}
        {!searchQuery && (activeCategory === 'all' || activeCategory === 'sa-vouchers') && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🇿🇦</span>
              <h2 className="text-sm font-black text-white">South Africa Featured</h2>
              <span className="text-[10px] font-bold text-primary/60 px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                Local Favourites
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {saProducts.map(product => (
                <ProductCard key={product.id} product={product} onClick={() => setSelectedProduct(product)} />
              ))}
            </div>
            <div className="neon-divider" />
          </section>
        )}

        {/* ── Popular picks (only on 'all' and not searching) ──────────────── */}
        {!searchQuery && activeCategory === 'all' && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              <h2 className="text-sm font-black text-white">Popular Right Now</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {popularProducts.map(product => (
                <ProductCard key={product.id} product={product} onClick={() => setSelectedProduct(product)} />
              ))}
            </div>
            <div className="neon-divider" />
          </section>
        )}

        {/* ── All / filtered results ─────────────────────────────────────── */}
        {filteredProducts.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-white/40" />
                <h2 className="text-sm font-black text-white">
                  {searchQuery ? `Results for "${searchQuery}"` : CATEGORY_CONFIG[activeCategory].label}
                </h2>
                <span className="text-[10px] text-white/30 font-bold">{filteredProducts.length} products</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} onClick={() => setSelectedProduct(product)} />
              ))}
            </div>
          </section>
        )}

      </div>

      {/* ── Product detail dialog ─────────────────────────────────────────── */}
      <Dialog open={!!selectedProduct} onOpenChange={open => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-md border-white/[0.08] bg-[#07090F]/98 backdrop-blur-3xl rounded-[28px] shadow-2xl shadow-black/70 max-h-[90vh] overflow-y-auto scroll-container">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setSelectedProduct(null)}
                className="h-7 w-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-white/50" />
              </button>
              <span className="font-black text-white">{selectedProduct?.name}</span>
              <Badge variant="outline" className="ml-auto text-[9px] font-black uppercase border-primary/30 text-primary/70">
                Powered by Bitrefill
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedProduct && (
            <PurchaseModal
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              userWallets={wallets}
              rates={rates ?? {}}
              livePrices={livePrices}
              firestore={firestore}
              userId={user?.uid}
            />
          )}
        </DialogContent>
      </Dialog>
    </PrivateRoute>
  );
}
