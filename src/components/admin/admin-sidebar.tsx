
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Settings, ShieldAlert, Bell } from "lucide-react";

export function AdminSidebar() {

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <ShieldAlert className="text-primary" />
            <h2 className="text-xl font-semibold text-primary">Admin Panel</h2>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="/admin" asChild>
              <a href="/admin">
                <LayoutDashboard />
                Dashboard
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton href="/admin/user-management" asChild>
              <a href="/admin/user-management">
                <Users />
                User Management
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton href="/admin/notification-center" asChild>
              <a href="/admin/notification-center">
                <Bell />
                Notification Center
              </a>
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
