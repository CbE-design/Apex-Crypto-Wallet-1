
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { Coins, Image, LayoutDashboard, Send, Settings, Sparkles, Bot, Repeat } from "lucide-react";

export function AppSidebar() {
  return (
    <>
      <SidebarHeader>
        <h2 className="text-xl font-semibold text-primary">Apex Wallet</h2>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="/" asChild>
              <a href="/">
                <LayoutDashboard />
                Dashboard
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton href="/ai-assistant" asChild>
              <a href="/ai-assistant">
                <Bot />
                AI Assistant
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="/send-receive" asChild>
              <a href="/send-receive">
                <Send />
                Send & Receive
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="/swap" asChild>
              <a href="/swap">
                <Repeat />
                Swap
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Staking" disabled>
              <Sparkles />
              Staking
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="NFTs" disabled>
              <Image />
              NFTs
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Settings">
              <Settings />
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
