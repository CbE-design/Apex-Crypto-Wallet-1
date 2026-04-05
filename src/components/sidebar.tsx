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
  ExternalLink,
} from "lucide-react";
import { useWallet } from "@/context/wallet-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { EyeWatermark } from "@/components/eye-watermark";

const mainNav = [
  { href: "/",             label: "Dashboard",    icon: LayoutDashboard, desc: "Overview"        },
  { href: "/wallets",      label: "My Wallets",   icon: Wallet,          desc: "Holdings"        },
  { href: "/swap",         label: "Swap",         icon: ArrowRightLeft,  desc: "Exchange assets" },
  { href: "/send-receive", label: "Send / Receive",icon: Send,           desc: "Transfer"        },
  { href: "/cash-out",     label: "Withdrawal",   icon: Banknote,        desc: "Withdraw funds"  },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot,             desc: "Ask anything"    },
];

export function AppSidebar() {
  const { isAdmin, wallet, user } = useWallet();
  const pathname = usePathname();
  const truncatedAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}···${wallet.address.slice(-4)}`
    : null;

  return (
    <>
      {/* ── Brand ── */}
      <SidebarHeader className="p-0">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border/60">
          <div className="relative flex-shrink-0">
            <img
              src="/apex-icon.png"
              alt="Apex Wallet"
              className="h-9 w-9 rounded-xl shadow-lg shadow-primary/30 object-cover"
            />
            {/* Live dot */}
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent border-2 border-sidebar" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[15px] font-bold tracking-tight text-white leading-none">Apex Wallet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Crypto Wallet</p>
          </div>
        </div>
      </SidebarHeader>

      {/* ── Main nav ── */}
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
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
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

          {isAdmin && (
            <>
              <div className="my-2 h-px bg-sidebar-border/50 group-data-[collapsible=icon]:hidden" />
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

      {/* ── Footer ── */}
      <SidebarFooter className="p-2 border-t border-sidebar-border/60 relative overflow-hidden">
        {/* Subliminal eye watermark */}
        <EyeWatermark
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-28 h-28 text-primary pointer-events-none group-data-[collapsible=icon]:opacity-0 transition-opacity"
          opacity={0.07}
        />
        {/* Wallet address strip */}
        {truncatedAddress && (
          <div className="group-data-[collapsible=icon]:hidden mb-2 px-3 py-2.5 rounded-xl bg-sidebar-accent/40 border border-sidebar-border/50">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Connected Wallet</p>
            <p className="font-mono text-[11px] text-sidebar-foreground/80">{truncatedAddress}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <p className="text-[10px] text-accent font-medium">Mainnet</p>
            </div>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Settings"
              className={cn(
                "h-10 rounded-xl px-3 gap-3 transition-all duration-150",
                pathname === "/settings"
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <Link href="/settings">
                <Settings className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="font-medium text-[13px]">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Legal links */}
        <div className="group-data-[collapsible=icon]:hidden mt-3 pt-3 border-t border-sidebar-border/40">
          <p className="px-3 text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/40 mb-1.5">Legal</p>
          <div className="grid grid-cols-2 gap-1 px-1">
            {[
              { href: '/legal/terms', label: 'Terms' },
              { href: '/legal/privacy', label: 'Privacy' },
              { href: '/legal/risk-disclosure', label: 'Risks' },
              { href: '/legal/aml-policy', label: 'AML/FICA' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1 text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors py-1 px-2 rounded-lg hover:bg-sidebar-accent/40"
              >
                <Scale className="h-2.5 w-2.5 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </SidebarFooter>
    </>
  );
}
