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
  LayoutDashboard, ShieldCheck, ArrowLeft, ArrowDownRight,
  UserCheck, Bell, Users, SlidersHorizontal, Wallet, Waves, Mail, Megaphone
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

function NavItem({ href, icon: Icon, label, badge, active }: {
  href: string; icon: any; label: string; badge?: number; active: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}
        className={cn(
          "h-9 rounded-xl px-3 gap-2.5 text-[12px] font-medium transition-all duration-150",
          active
            ? "bg-cyan-500/12 text-cyan-300 border border-cyan-500/20"
            : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
        )}>
        <Link href={href} className="flex items-center w-full">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-cyan-400" : "text-white/25")} />
          <span>{label}</span>
          {badge != null && badge > 0 && (
            <span className="ml-auto h-4.5 min-w-[18px] px-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/25 text-[9px] font-bold flex items-center justify-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

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

  const wCount = pendingWithdrawals?.length || 0;
  const kCount = pendingKyc?.length || 0;
  const nCount = unreadNotifications?.length || 0;
  const uCount = allUsers?.length || 0;
  const pendingTotal = wCount + kCount;

  return (
    <>
      <SidebarHeader className="p-0">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.05]">
          <div className="relative p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            {pendingTotal > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-[8px] font-black text-black flex items-center justify-center">
                {pendingTotal > 9 ? '9+' : pendingTotal}
              </span>
            )}
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[13px] font-bold tracking-tight text-cyan-300 leading-none">Admin</p>
            <p className="text-[9px] text-cyan-500/50 mt-0.5 font-semibold tracking-[0.15em] uppercase">Control Centre</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarMenu className="gap-0.5">
          <NavItem href="/admin" icon={LayoutDashboard} label="Dashboard" active={pathname === "/admin"} />

          <div className="my-2 px-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/18">Approvals</p>
          </div>

          <NavItem href="/admin/withdrawals" icon={ArrowDownRight} label="Withdrawals" badge={wCount} active={pathname === "/admin/withdrawals"} />
          <NavItem href="/admin/kyc" icon={UserCheck} label="KYC Verification" badge={kCount} active={pathname === "/admin/kyc"} />

          <div className="my-2 px-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/18">Management</p>
          </div>

          <NavItem href="/admin/users" icon={Users} label="User Registry" badge={uCount} active={pathname === "/admin/users"} />
          <NavItem href="/admin/notifications" icon={Bell} label="Notifications" badge={nCount} active={pathname === "/admin/notifications"} />
          <NavItem href="/admin/notification-center" icon={Megaphone} label="Broadcast" active={pathname === "/admin/notification-center"} />
          <NavItem href="/admin/direct-send" icon={Wallet} label="Fund Wallet" active={pathname === "/admin/direct-send"} />
          <NavItem href="/admin/whale" icon={Waves} label="Whale Treasury" active={pathname === "/admin/whale"} />
          <NavItem href="/admin/email-marketing" icon={Mail} label="Email Marketing" active={pathname === "/admin/email-marketing"} />
          <NavItem href="/admin/settings" icon={SlidersHorizontal} label="Settings" active={pathname === "/admin/settings"} />

          <div className="my-2 neon-divider" />

          <SidebarMenuItem>
            <SidebarMenuButton asChild
              className="h-9 rounded-xl px-3 gap-2.5 text-[12px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all">
              <Link href="/">
                <ArrowLeft className="h-3.5 w-3.5 text-white/20" />
                <span>Exit Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-white/[0.05]">
        <div className="text-[9px] font-bold text-white/15 uppercase tracking-[0.15em] text-center">
          Apex Admin · v6
        </div>
      </SidebarFooter>
    </>
  );
}
