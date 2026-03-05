'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { LayoutDashboard, Send, Settings, Sparkles, Bot, Repeat, ShieldCheck, Banknote, Wallet, Image as ImageIcon } from "lucide-react";
import { useWallet } from "@/context/wallet-context";
import Link from "next/link";

export function AppSidebar() {
  const { isAdmin } = useWallet();

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="bg-primary p-1.5 rounded-lg">
            <Wallet className="h-6 w-6 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold text-primary">Apex Wallet</h2>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                <LayoutDashboard />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/wallets">
                <Wallet />
                <span>My Wallets</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/ai-assistant">
                <Bot />
                <span>AI Assistant</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/send-receive">
                <Send />
                <span>Send & Receive</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/swap">
                <Repeat />
                <span>Swap</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/cash-out">
                <Banknote />
                <span>Cash Out</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isAdmin && (
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <Link href="/admin">
                        <ShieldCheck />
                        <span>Admin Panel</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/coming-soon">
                <Sparkles />
                <span>Staking</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/coming-soon">
                <ImageIcon />
                <span>NFTs</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
                <Link href="/settings">
                    <Settings />
                    <span>Settings</span>
                </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
