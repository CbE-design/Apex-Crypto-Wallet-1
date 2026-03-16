'use client';

import { Bell, LogOut, Settings, User, ChevronDown, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useWallet } from '@/context/wallet-context';
import { useRouter, usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/currency-context';
import { currencies } from '@/lib/currencies';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const PAGE_TITLES: Record<string, string> = {
  '/':              'Dashboard',
  '/wallets':       'My Wallets',
  '/swap':          'Swap',
  '/send-receive':  'Send & Receive',
  '/cash-out':      'Cash Out',
  '/ai-assistant':  'Support',
  '/settings':      'Settings',
};

export function Header() {
  const { wallet, disconnectWallet, user } = useWallet();
  const { currency, setCurrency } = useCurrency();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const pageTitle = PAGE_TITLES[pathname] ?? 'Apex Wallet';

  const onDisconnect = () => {
    disconnectWallet();
    toast({ title: 'Wallet disconnected' });
    router.push('/login');
  };

  const truncatedAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}···${wallet.address.slice(-4)}`
    : '';

  const copyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      toast({ title: 'Address copied' });
    }
  };

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : null;

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-border/60">
      {/* Left: page title */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden -ml-1 h-8 w-8 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors" />
        <h1 className="text-[15px] font-semibold text-foreground tracking-tight">{pageTitle}</h1>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1.5">

        {/* Currency picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 rounded-lg text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <span className="text-foreground/80">{currency.symbol}</span>
              <span className="hidden sm:inline">{currency.flag}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground px-2 py-1.5">
              Display Currency
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {currencies.map((c) => (
                <DropdownMenuItem
                  key={c.symbol}
                  onClick={() => setCurrency(c.symbol)}
                  className={cn(
                    "rounded-lg cursor-pointer text-[13px]",
                    currency.symbol === c.symbol && "bg-primary/10 text-primary"
                  )}
                >
                  <span className="mr-2">{c.flag}</span>
                  <span className="font-medium">{c.symbol}</span>
                  <span className="ml-auto text-muted-foreground text-[11px]">{c.name}</span>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Support / Notifications bell — navigates to AI support chat */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/ai-assistant')}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 relative"
          title="Customer Support"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        </Button>

        {/* Profile / Account dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg p-0 overflow-hidden border border-border/60 hover:border-primary/40 transition-colors"
            >
              <div className="h-full w-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
                {initials ? (
                  <span className="text-[10px] font-bold text-primary">{initials}</span>
                ) : (
                  <User className="h-3.5 w-3.5 text-primary/70" />
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1">
            {/* Email */}
            {user?.email && (
              <>
                <div className="px-2 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Signed in as</p>
                  <p className="text-[12px] font-medium text-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            {/* Wallet address */}
            {truncatedAddress && (
              <>
                <div className="px-2 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Wallet Address</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-foreground flex-1 truncate">{truncatedAddress}</code>
                    <button
                      onClick={copyAddress}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer text-[13px]">
              <Link href="/settings">
                <Settings className="mr-2 h-3.5 w-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDisconnect}
              className="rounded-lg cursor-pointer text-[13px] text-destructive hover:text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Disconnect Wallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}
