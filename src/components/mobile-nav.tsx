'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, ArrowRightLeft, Gift, Send, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Home',      href: '/'             },
  { icon: Wallet,          label: 'Wallets',   href: '/wallets'      },
  { icon: ArrowRightLeft,  label: 'Swap',      href: '/swap'         },
  { icon: Gift,            label: 'Bitrefill', href: '/bitrefill'    },
  { icon: Send,            label: 'Send',      href: '/send-receive' },
  { icon: Bot,             label: 'AI',        href: '/ai-assistant' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden h-16 flex items-center justify-around px-2 z-50">
      {navItems.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const isAI = item.href === '/ai-assistant';
        return (
          <Link key={item.href} href={item.href}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-2 relative group">
            <div className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 relative",
              isActive
                ? isAI
                  ? "bg-gradient-to-br from-violet-500/20 to-cyan-500/15 border border-violet-500/30 shadow-lg shadow-violet-500/20"
                  : "bg-violet-500/15 border border-violet-500/25 shadow-lg shadow-violet-500/15"
                : "group-active:bg-white/5"
            )}>
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  isActive ? "text-violet-400" : "text-white/25"
                )}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              {isAI && !isActive && (
                <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
              )}
              {isActive && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-violet-400" />
              )}
            </div>
            <span className={cn(
              "text-[9px] font-semibold tracking-wide transition-colors leading-none",
              isActive ? "text-violet-400" : "text-white/25"
            )}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
