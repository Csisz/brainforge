"use client";

import { useTranslations } from "next-intl";
import { LayoutDashboard, Users, SquarePlus, History, Settings } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ITEMS = [
  { href: "/app", key: "overview", icon: LayoutDashboard },
  { href: "/app/children", key: "children", icon: Users },
  { href: "/app/new-session", key: "newSession", icon: SquarePlus },
  { href: "/app/history", key: "history", icon: History },
  { href: "/app/settings", key: "settings", icon: Settings },
] as const;

export function AppSidebar() {
  const t = useTranslations("nav");
  const tAccount = useTranslations("account");
  const pathname = usePathname();
  const parentLabel = tAccount("parentPlaceholder");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
          <span className="font-display text-base font-extrabold tracking-tight text-ink group-data-[collapsible=icon]:hidden">
            BrainForge
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ITEMS.map((item) => {
                const isActive = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.key)}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{t(item.key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="size-7">
            <AvatarFallback className="bg-crayon-soft text-xs font-semibold text-ink">
              {parentLabel.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-ink-soft group-data-[collapsible=icon]:hidden">{parentLabel}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
