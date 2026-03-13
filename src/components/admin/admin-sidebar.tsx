'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { LayoutDashboard, Settings, ShieldAlert, Bell, DollarSign, Mail } from "lucide-react";
import Link from "next/link";

export function AdminSidebar() {
  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
            <ShieldAlert className="text-primary h-6 w-6" />
            <h2 className="text-xl font-semibold text-primary">Admin Panel</h2>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/admin">
                <LayoutDashboard />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
           <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/admin/direct-send">
                <DollarSign />
                <span>Direct Send</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
           <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/admin/notification-center">
                <Bell />
                <span>Notification Center</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
           <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/admin/email-marketing">
                <Mail />
                <span>Email Marketing</span>
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