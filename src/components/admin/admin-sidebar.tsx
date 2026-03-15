
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
import { LayoutDashboard, Settings, ShieldAlert, Bell, DollarSign, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSidebar() {
  const pathname = usePathname();

  const adminItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/direct-send", label: "Direct Send", icon: DollarSign },
    { href: "/admin/notification-center", label: "Notification Center", icon: Bell },
    { href: "/admin/email-marketing", label: "Email Marketing", icon: Mail },
  ];

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-3 py-6">
            <div className="bg-destructive/20 p-2 rounded-xl border border-destructive/30">
                <ShieldAlert className="text-destructive h-6 w-6" />
            </div>
            <div>
                <h2 className="text-lg font-black tracking-tight text-destructive">ADMIN</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Security Terminal</p>
            </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2">
        <SidebarMenu>
          {adminItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={pathname === item.href}>
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          
          <div className="my-4 border-t border-white/5 mx-2" />
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="text-muted-foreground hover:text-white">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span>Exit Terminal</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
