'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, Send, ArrowRightLeft, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Home',   href: '/'             },
  { icon: Wallet,          label: 'Wallets', href: '/wallets'      },
  { icon: ArrowRightLeft,  label: 'Swap',    href: '/swap'         },
  { icon: Send,            label: 'Send',    href: '/send-receive' },
  { icon: Bot,             label: 'AI',      href: '/ai-assistant' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden h-16 bg-background/95 backdrop-blur-xl border-t border-border/50 flex items-center justify-around px-2 z-50">
      {navItems.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-2 relative group transition-all"
          >
            <div
              className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200",
                isActive
                  ? "bg-primary/15 border border-primary/25 shadow-sm shadow-primary/10"
                  : "group-active:bg-muted/50"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-medium transition-colors leading-none",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
