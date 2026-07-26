'use client';

import Link from 'next/link';
import { ArrowRightLeft, Send, Banknote, Wallet, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  {
    href: '/swap',
    label: 'Swap',
    desc: 'Exchange assets',
    icon: ArrowRightLeft,
    gradient: 'from-primary/80 to-primary',
    glow: 'shadow-primary/25',
    border: 'border-primary/20',
    bg: 'hover:bg-primary/5',
  },
  {
    href: '/send-receive',
    label: 'Send',
    desc: 'Transfer crypto',
    icon: Send,
    gradient: 'from-violet-500/80 to-violet-600',
    glow: 'shadow-violet-500/25',
    border: 'border-violet-500/20',
    bg: 'hover:bg-violet-500/5',
  },
  {
    href: '/send-receive?tab=receive',
    label: 'Receive',
    desc: 'Deposit crypto',
    icon: Wallet,
    gradient: 'from-accent/80 to-accent',
    glow: 'shadow-accent/25',
    border: 'border-accent/20',
    bg: 'hover:bg-accent/5',
  },
  {
    href: '/cash-out',
    label: 'Withdraw',
    desc: 'Cash out funds',
    icon: Banknote,
    gradient: 'from-amber-500/80 to-amber-600',
    glow: 'shadow-amber-500/25',
    border: 'border-amber-500/20',
    bg: 'hover:bg-amber-500/5',
  },
  {
    href: '/ai-assistant',
    label: 'AI Help',
    desc: 'Support & info',
    icon: Bot,
    gradient: 'from-pink-500/80 to-pink-600',
    glow: 'shadow-pink-500/25',
    border: 'border-pink-500/20',
    bg: 'hover:bg-pink-500/5',
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-5 gap-3">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "group flex flex-col items-center gap-2.5 p-3.5 rounded-2xl",
            "bg-[#0A0C12]/60 backdrop-blur-sm border transition-all duration-200",
            "hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]",
            action.border,
            action.bg,
            action.glow,
          )}
        >
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br",
            action.gradient,
            action.glow,
          )}>
            <action.icon className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div className="text-center">
            <p className="text-[12px] font-semibold text-white leading-none mb-0.5">{action.label}</p>
            <p className="text-[10px] text-muted-foreground leading-none hidden sm:block">{action.desc}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
