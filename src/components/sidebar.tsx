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
  Sparkles, 
  Bot, 
  Repeat, 
  ShieldCheck, 
  Banknote, 
  Wallet, 
  Image as ImageIcon 
} from "lucide-react";
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
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/wallets">
                <Wallet className="h-4 w-4" />
                <span>My Wallets</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/ai-assistant">
                <Bot className="h-4 w-4" />
                <span>AI Assistant</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/send-receive">
                <Send className="h-4 w-4" />
                <span>Send & Receive</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/swap">
                <Repeat className="h-4 w-4" />
                <span>Swap</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/cash-out">
                <Banknote className="h-4 w-4" />
                <span>Cash Out</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          {isAdmin && (
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <Link href="/admin">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Admin Panel</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/coming-soon">
                <Sparkles className="h-4 w-4" />
                <span>Staking</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/coming-soon">
                <ImageIcon className="h-4 w-4" />
                <span>NFTs</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
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
