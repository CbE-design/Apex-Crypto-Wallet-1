'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { Coins, Image, LayoutDashboard, Send, Settings, Sparkles, Bot, Repeat, ShieldCheck, Banknote, Wallet } from "lucide-react";
import { useWallet } from "@/context/wallet-context";

export function AppSidebar() {
  const { isAdmin } = useWallet();

  return (
    <>
      <SidebarHeader>
        <h2 className="text-xl font-semibold text-primary">Apex Wallet</h2>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/">
                <LayoutDashboard />
                Dashboard
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/wallets">
                <Wallet />
                My Wallets
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/ai-assistant">
                <Bot />
                AI Assistant
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/send-receive">
                <Send />
                Send & Receive
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/swap">
                <Repeat />
                Swap
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/cash-out">
                <Banknote />
                Cash Out
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isAdmin && (
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <a href="/admin">
                        <ShieldCheck />
                        Admin Panel
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/coming-soon">
                <Sparkles />
                Staking
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/coming-soon">
                <Image />
                NFTs
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
                <a href="/settings">
                    <Settings />
                    Settings
                </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
