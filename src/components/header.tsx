'use client';

import { LogOut, Settings, User, Copy, Bell } from 'lucide-react';
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
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const CurrencySwitcher = dynamic(
  () => import('@/components/currency-switcher').then((mod) => mod.CurrencySwitcher),
  {
    ssr: false,
    loading: () => <Skeleton className="h-8 w-24" />,
  }
);

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/wallets': 'My Wallets',
  '/swap': 'Swap',
  '/send-receive': 'Send & Receive',
  '/cash-out': 'Withdrawal',
  '/ai-assistant': 'AI Assistant',
  '/settings': 'Settings',
};

export function Header() {
  const { wallet, disconnectWallet, user } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const pageTitle = PAGE_TITLES[pathname] ?? 'Apex Private Ledger';

  const onDisconnect = () => {
    disconnectWallet();
    toast({ title: 'Wallet disconnected' });
    router.push('/login');
  };

  const truncatedAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}···${wallet.address.slice(-4)}`
    : '';

  const copyAddress = async () => {
    if (!wallet?.address) {
      return;
    }

    const address = wallet.address;

    try {
      await navigator.clipboard.writeText(address);
      toast({ title: 'Address copied' });
    } catch (err) {
      console.warn('Clipboard API failed. Falling back to execCommand.', err);

      const textArea = document.createElement('textarea');
      textArea.value = address;
      
      // Prevent scrolling to bottom of page in MS Edge.
      textArea.style.position = 'fixed';
      textArea.style.top = "0";
      textArea.style.left = "0";

      // Ensure it has a small size and is transparent
      textArea.style.width = '1px';
      textArea.style.height = '1px';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';


      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          toast({ title: 'Address copied' });
        } else {
          throw new Error('execCommand returned false.');
        }
      } catch (fallbackErr) {
        console.error('Fallback copy method failed:', fallbackErr);
        toast({
          title: 'Copy failed',
          description: 'Could not copy address to clipboard.',
          variant: 'destructive',
        });
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : null;

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-white/[0.05]">
      {/* Left */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden -ml-1 h-8 w-8 rounded-lg hover:bg-white/[0.05] text-white/40 transition-colors" />
        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex h-5 w-5 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          </div>
          <h1 className="text-[15px] font-semibold text-white/90 tracking-tight">{pageTitle}</h1>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        <CurrencySwitcher />

        {/* Notifications placeholder */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition-colors relative"
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg p-0 overflow-hidden border border-violet-500/20 hover:border-violet-500/40 transition-all shadow-sm shadow-violet-500/10"
            >
              <div className="h-full w-full bg-gradient-to-br from-violet-500/25 to-cyan-500/15 flex items-center justify-center">
                {initials ? (
                  <span className="text-[10px] font-bold text-violet-300">{initials}</span>
                ) : (
                  <User className="h-3.5 w-3.5 text-violet-400/70" />
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 bg-[#0A0C12]/95 backdrop-blur-xl border-white/[0.08]">
            {user?.email && (
              <>
                <div className="px-2 py-2">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/25 mb-0.5">Signed in as</p>
                  <p className="text-[12px] font-medium text-white/80 truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-white/[0.05]" />
              </>
            )}
            {truncatedAddress && (
              <>
                <div className="px-2 py-2">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/25 mb-1">Wallet</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-white/60 flex-1 truncate">{truncatedAddress}</code>
                    <button onClick={copyAddress} className="text-white/25 hover:text-violet-400 transition-colors">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-white/[0.05]" />
              </>
            )}
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer text-[13px] text-white/60 hover:text-white">
              <Link href="/settings">
                <Settings className="mr-2 h-3.5 w-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.05]" />
            <DropdownMenuItem
              onClick={onDisconnect}
              className="rounded-lg cursor-pointer text-[13px] text-red-400 hover:text-red-300 focus:text-red-300"
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
