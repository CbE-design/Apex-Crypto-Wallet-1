
'use client';

import * as React from "react";
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Send, 
  Settings, 
  Bot, 
  Repeat, 
  Banknote, 
  Wallet,
  ShieldCheck
} from "lucide-react";
import { useWallet } from "@/context/wallet-context";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppSidebar() {
  const { isAdmin } = useWallet();
  const pathname = usePathname();

  const menuItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/wallets", label: "My Wallets", icon: Wallet },
    { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
    { href: "/send-receive", label: "Send & Receive", icon: Send },
    { href: "/swap", label: "Swap", icon: Repeat },
    { href: "/cash-out", label: "Cash Out", icon: Banknote },
  ];

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-3 py-6">
          <div className="bg-primary/20 p-2 rounded-xl border border-primary/30">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">APEX</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Private Ledger</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={pathname === item.href}>
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/admin"}>
                <Link href="/admin">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Admin Panel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"}>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
