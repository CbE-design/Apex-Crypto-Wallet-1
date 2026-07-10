'use client';

import * as React from "react";
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Send,
  Settings,
  Bot,
  Banknote,
  Wallet,
  ShieldCheck,
  ArrowRightLeft,
  Scale,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Zap,
} from "lucide-react";
import { useWallet } from "@/context/wallet-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Defining the main navigation links
const mainNav = [
  { href: "/",             label: "Dashboard",      icon: LayoutDashboard, },
  // Ensuring the "My Wallets" link is present and correct
  { href: "/wallets",      label: "My Wallets",     icon: Wallet,          },
  { href: "/swap",         label: "Swap",           icon: ArrowRightLeft,  },
  { href: "/send-receive", label: "Send / Receive", icon: Send,            },
  { href: "/cash-out",     label: "Withdrawal",     icon: Banknote,        },
];

const legalLinks = [
  { href: '/legal/terms',           label: 'Terms of Service',   desc: 'User agreement & platform rules' },
  { href: '/legal/privacy',         label: 'Privacy Policy',     desc: 'POPIA-compliant data handling'   },
  { href: '/legal/risk-disclosure', label: 'Risk Disclosure',    desc: 'Investment & crypto risks'       },
  { href: '/legal/aml-policy',      label: 'AML & FICA Policy',  desc: 'Compliance & KYC framework'      },
];

export function AppSidebar() {
  const { isAdmin, wallet } = useWallet();
  const pathname = usePathname();
  const [legalOpen, setLegalOpen] = React.useState(false);

  const truncatedAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null;

  return (
    <>
      {/* Brand */}
      <SidebarHeader className="p-0">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.05]">
          <div className="relative flex-shrink-0">
            <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-violet-500/30 shadow-lg shadow-violet-500/20">
              <img src="/apex-icon.png" alt="Apex" className="h-full w-full object-cover" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-cyan-400 border-2 border-[#050709] shadow-sm shadow-cyan-400/50" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[14px] font-bold tracking-tight text-white leading-none">Apex Wallet</p>
            <p className="text-[10px] text-violet-400/70 mt-0.5 font-medium tracking-wide">INSTITUTIONAL</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Main nav */}
      <SidebarContent className="px-2 py-3">
        <div className="mb-1 px-2 group-data-[collapsible=icon]:hidden">
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/20">Navigation</p>
        </div>
        <SidebarMenu className="gap-0.5">
          {mainNav.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "h-10 rounded-xl px-3 gap-3 transition-all duration-150 font-medium text-[13px]",
                    isActive
                      ? "bg-violet-500/15 text-violet-300 border border-violet-500/25 shadow-sm shadow-violet-500/10"
                      : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-violet-400" : "text-white/30")} />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          {/* AI Assistant */}
          <div className="my-2.5 neon-divider group-data-[collapsible=icon]:hidden" />
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith('/ai-assistant')}
              tooltip="AI Assistant"
              className={cn(
                "h-10 rounded-xl px-3 gap-3 transition-all duration-150 font-medium text-[13px]",
                pathname.startsWith('/ai-assistant')
                  ? "bg-gradient-to-r from-violet-500/15 to-cyan-500/10 text-violet-300 border border-violet-500/20"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
              )}
            >
              <Link href="/ai-assistant">
                <div className="relative">
                  <Bot className={cn("h-4 w-4 flex-shrink-0", pathname.startsWith('/ai-assistant') ? "text-violet-400" : "text-white/30")} />
                  <Sparkles className="h-2 w-2 text-cyan-400 absolute -top-1 -right-1" />
                </div>
                <span>AI Assistant</span>
                <span className="ml-auto group-data-[collapsible=icon]:hidden">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    AI
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {isAdmin && (
            <>
              <div className="my-2.5 neon-divider group-data-[collapsible=icon]:hidden" />
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/admin")}
                  tooltip="Admin Panel"
                  className={cn(
                    "h-10 rounded-xl px-3 gap-3 transition-all duration-150 font-medium text-[13px]",
                    pathname.startsWith("/admin")
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20"
                      : "text-cyan-500/60 hover:text-cyan-400 hover:bg-cyan-500/5"
                  )}
                >
                  <Link href="/admin">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                    <span className="font-semibold">Admin Panel</span>
                    <Zap className="ml-auto h-3 w-3 text-cyan-400/60 group-data-[collapsible=icon]:hidden" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-2 border-t border-white/[0.05] relative overflow-hidden">
        {/* Wallet address strip */}
        {truncatedAddress && (
          <div className="group-data-[collapsible=icon]:hidden mb-2 px-3 py-2.5 rounded-xl bg-violet-500/5 border border-violet-500/10">
            <p className="text-[9px] uppercase tracking-[0.15em] font-semibold text-white/25 mb-1">Connected</p>
            <p className="font-mono text-[11px] text-white/60">{truncatedAddress}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400/50" />
              <p className="text-[10px] text-cyan-400/80 font-medium">Mainnet · Live</p>
            </div>
          </div>
        )}

        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Settings"
              className={cn(
                "h-10 rounded-xl px-3 gap-3 transition-all duration-150 font-medium text-[13px]",
                pathname === "/settings"
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/20"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              )}
            >
              <Link href="/settings">
                <Settings className="h-4 w-4 flex-shrink-0 text-white/25" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Legal"
              onClick={() => setLegalOpen(o => !o)}
              className={cn(
                "h-10 rounded-xl px-3 gap-3 transition-all duration-150 cursor-pointer font-medium text-[13px]",
                legalOpen
                  ? "bg-violet-500/10 text-violet-300 border border-violet-500/15"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              )}
            >
              <Scale className="h-4 w-4 flex-shrink-0 text-white/25" />
              <span className="group-data-[collapsible=icon]:hidden">Legal & Compliance</span>
              <span className="ml-auto group-data-[collapsible=icon]:hidden">
                {legalOpen ? <ChevronUp className="h-3.5 w-3.5 text-white/20" /> : <ChevronDown className="h-3.5 w-3.5 text-white/20" />}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {legalOpen && (
          <div className="group-data-[collapsible=icon]:hidden mt-1 rounded-xl border border-violet-500/10 bg-violet-500/5 overflow-hidden">
            <div className="px-3 pt-2.5 pb-2 border-b border-white/[0.04]">
              <div className="flex flex-wrap gap-1">
                {['FICA', 'POPIA', 'FSCA', 'FATF'].map(badge => (
                  <span key={badge} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400/60 border border-violet-500/15">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-1.5 space-y-0.5">
              {legalLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setLegalOpen(false)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors group/item"
                >
                  <p className="text-[11px] font-medium text-white/50 group-hover/item:text-white/75 transition-colors">{label}</p>
                  <ExternalLink className="h-2.5 w-2.5 text-white/20 group-hover/item:text-violet-400/50 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </SidebarFooter>
    </>
  );
}
