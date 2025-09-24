
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { Coins, Image, LayoutDashboard, Send, Settings, Sparkles, Bot, Repeat, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export function AppSidebar() {
  const { userProfile } = useAuth();

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
          {userProfile?.isAdmin && (
             <SidebarMenuItem>
                <SidebarMenuButton href="/admin" asChild>
                    <a href="/admin">
                        <ShieldCheck />
                        Admin
                    </a>
                </SidebarMenuButton>
             </SidebarMenuItem>
          )}
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
