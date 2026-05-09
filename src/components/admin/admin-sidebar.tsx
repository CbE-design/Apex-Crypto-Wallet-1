
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
import { LayoutDashboard, ShieldAlert, ArrowLeft, ArrowDownRight, UserCheck, Bell, Users, SlidersHorizontal, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export function AdminSidebar() {
  const pathname = usePathname();
  const firestore = useFirestore();

  const withdrawalsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'withdrawal_requests'), where('status', '==', 'PENDING'));
  }, [firestore]);

  const kycRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'kyc_submissions'), where('status', '==', 'PENDING'));
  }, [firestore]);

  const notificationsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'admin_notifications'), where('read', '==', false));
  }, [firestore]);

  const usersRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: pendingWithdrawals } = useCollection(withdrawalsRef);
  const { data: pendingKyc } = useCollection(kycRef);
  const { data: unreadNotifications } = useCollection(notificationsRef);
  const { data: allUsers } = useCollection(usersRef);

  const pendingWithdrawalsCount = pendingWithdrawals?.length || 0;
  const pendingKycCount = pendingKyc?.length || 0;
  const unreadCount = unreadNotifications?.length || 0;
  const totalUsers = allUsers?.length || 0;
  const pendingTotal = pendingWithdrawalsCount + pendingKycCount;

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-3 py-6">
            <div className="bg-destructive/20 p-2 rounded-xl border border-destructive/30 relative">
                <ShieldAlert className="text-destructive h-6 w-6" />
                {pendingTotal > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[9px] font-black text-white flex items-center justify-center">
                    {pendingTotal > 9 ? '9+' : pendingTotal}
                  </span>
                )}
            </div>
            <div>
                <h2 className="text-lg font-black tracking-tight text-destructive">ADMIN</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Control Centre</p>
            </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin"}>
              <Link href="/admin">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <div className="my-3 border-t border-white/5 mx-2" />
          
          <p className="px-3 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Approvals Queue</p>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin/withdrawals"}>
              <Link href="/admin/withdrawals" className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4" />
                  <span>Withdrawals</span>
                </div>
                {pendingWithdrawalsCount > 0 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-500/20 text-amber-500 border-amber-500/30 ml-auto">
                    {pendingWithdrawalsCount}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin/kyc"}>
              <Link href="/admin/kyc" className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  <span>KYC Verification</span>
                </div>
                {pendingKycCount > 0 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-500/20 text-amber-500 border-amber-500/30 ml-auto">
                    {pendingKycCount}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <div className="my-3 border-t border-white/5 mx-2" />

          <p className="px-3 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Management</p>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin/users"}>
              <Link href="/admin/users" className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>User Registry</span>
                </div>
                {totalUsers > 0 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-primary/20 text-primary border-primary/30 ml-auto">
                    {totalUsers}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin/notifications"}>
              <Link href="/admin/notifications" className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-primary/20 text-primary border-primary/30 ml-auto">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin/direct-send"}>
              <Link href="/admin/direct-send">
                <Wallet className="h-4 w-4" />
                <span>Fund Wallet</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin/settings"}>
              <Link href="/admin/settings">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <div className="my-3 border-t border-white/5 mx-2" />
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="text-muted-foreground hover:text-white">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span>Exit Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="p-2">
        <div className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center">
          Apex Wallet Admin v5
        </div>
      </SidebarFooter>
    </>
  );
}
