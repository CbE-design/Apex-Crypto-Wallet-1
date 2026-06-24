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
} from "lucide-react";
import { useWallet } from "@/context/wallet-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { EyeWatermark } from "@/components/eye-watermark";

const mainNav = [
  { href: "/",             label: "Dashboard",      icon: LayoutDashboard, desc: "Overview",        accent: false },
  { href: "/wallets",      label: "My Wallets",     icon: Wallet,          desc: "Holdings",        accent: false },
  { href: "/swap",         label: "Swap",           icon: ArrowRightLeft,  desc: "Exchange assets", accent: false },
  { href: "/send-receive", label: "Send / Receive", icon: Send,            desc: "Transfer",        accent: false },
  { href: "/cash-out",     label: "Withdrawal",     icon: Banknote,        desc: "Withdraw funds",  accent: false },
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
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="relative flex-shrink-0">
            <div className="h-9 w-9 rounded-xl overflow-hidden shadow-lg shadow-primary/20 ring-1 ring-white/10">
              <img
                src="/apex-icon.png"
                alt="Apex Wallet"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent border-2 border-sidebar shadow-sm shadow-accent/50" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[15px] font-bold tracking-tight text-white leading-none">Apex Wallet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Institutional Custody</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Main nav */}
      <SidebarContent className="px-2 py-3">
        <SidebarMenu className="gap-0.5">
          {mainNav.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "h-10 rounded-xl px-3 gap-3 transition-all duration-150",
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/20 shadow-sm shadow-primary/10"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/5"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="font-medium text-[13px]">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          {/* AI Assistant — visually distinct */}
          <div className="my-2 h-px bg-white/5 group-data-[collapsible=icon]:hidden" />
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith('/ai-assistant')}
              tooltip="AI Assistant"
              className={cn(
                "h-10 rounded-xl px-3 gap-3 transition-all duration-150",
                pathname.startsWith('/ai-assistant')
                  ? "bg-gradient-to-r from-primary/20 to-accent/15 text-primary border border-primary/20 shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/5"
              )}
            >
              <Link href="/ai-assistant">
                <div className="relative">
                  <Bot className={cn(
                    "h-4 w-4 flex-shrink-0",
                    pathname.startsWith('/ai-assistant') ? "text-primary" : "text-muted-foreground"
                  )} />
                  <Sparkles className="h-2 w-2 text-accent absolute -top-1 -right-1" />
                </div>
                <span className="font-medium text-[13px]">AI Assistant</span>
                <span className="ml-auto group-data-[collapsible=icon]:hidden">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/20">
                    AI
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {isAdmin && (
            <>
              <div className="my-2 h-px bg-white/5 group-data-[collapsible=icon]:hidden" />
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/admin")}
                  tooltip="Admin Panel"
                  className={cn(
                    "h-10 rounded-xl px-3 gap-3 transition-all duration-150",
                    pathname.startsWith("/admin")
                      ? "bg-accent/15 text-accent border border-accent/20"
                      : "text-accent/70 hover:text-accent hover:bg-accent/10"
                  )}
                >
                  <Link href="/admin">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                    <span className="font-semibold text-[13px]">Admin Panel</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-2 border-t border-white/5 relative overflow-hidden">
        <EyeWatermark
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-28 h-28 text-primary pointer-events-none group-data-[collapsible=icon]:opacity-0 transition-opacity"
          opacity={0.06}
        />

        {/* Wallet address strip */}
        {truncatedAddress && (
          <div className="group-data-[collapsible=icon]:hidden mb-2 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Connected Wallet</p>
            <p className="font-mono text-[11px] text-sidebar-foreground/80">{truncatedAddress}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shadow-sm shadow-accent/50" />
              <p className="text-[10px] text-accent font-medium">Mainnet · Live</p>
            </div>
          </div>
        )}

        <SidebarMenu className="gap-0.5">
          {/* Settings */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Settings"
              className={cn(
                "h-10 rounded-xl px-3 gap-3 transition-all duration-150",
                pathname === "/settings"
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/5"
              )}
            >
              <Link href="/settings">
                <Settings className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="font-medium text-[13px]">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Legal */}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Legal & Compliance"
              onClick={() => setLegalOpen(o => !o)}
              className={cn(
                "h-10 rounded-xl px-3 gap-3 transition-all duration-150 cursor-pointer group-data-[collapsible=icon]:justify-center",
                legalOpen
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/5"
              )}
            >
              <Scale className={cn("h-4 w-4 flex-shrink-0", legalOpen ? "text-primary" : "text-muted-foreground")} />
              <span className="font-medium text-[13px] group-data-[collapsible=icon]:hidden">Legal & Compliance</span>
              <span className="ml-auto group-data-[collapsible=icon]:hidden">
                {legalOpen
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/60" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Legal panel */}
        {legalOpen && (
          <div className="group-data-[collapsible=icon]:hidden mt-1 rounded-xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="px-3 pt-3 pb-2 border-b border-white/5">
              <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/50 mb-1.5">Regulatory Compliance</p>
              <div className="flex flex-wrap gap-1">
                {['FICA', 'POPIA', 'FSCA', 'FATF'].map(badge => (
                  <span key={badge} className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary/60 border border-primary/15">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-1.5 space-y-0.5">
              {legalLinks.map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setLegalOpen(false)}
                  className="flex items-start justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors group/item"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-sidebar-foreground/80 group-hover/item:text-sidebar-foreground transition-colors leading-tight">{label}</p>
                    <p className="text-[9px] text-muted-foreground/50 mt-0.5 leading-tight">{desc}</p>
                  </div>
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/30 group-hover/item:text-muted-foreground/60 shrink-0 mt-0.5 transition-colors" />
                </Link>
              ))}
            </div>
            <div className="px-3 pt-1 pb-3 border-t border-white/5 mt-1">
              <p className="text-[9px] text-muted-foreground/35 leading-relaxed">
                Crypto assets are high-risk instruments. You may lose your entire investment. Not financial advice.
              </p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </>
  );
}
