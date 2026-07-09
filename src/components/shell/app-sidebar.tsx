"use client";

import { useTranslations } from "next-intl";
import { LayoutDashboard, Users, SquarePlus, History, Settings, LogOut } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

const ITEMS = [
  { href: "/app", key: "overview", icon: LayoutDashboard },
  { href: "/app/children", key: "children", icon: Users },
  { href: "/app/new-session", key: "newSession", icon: SquarePlus },
  { href: "/app/history", key: "history", icon: History },
  { href: "/app/settings", key: "settings", icon: Settings },
] as const;

export function AppSidebar({ userEmail, locale }: { userEmail: string; locale: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const initial = (userEmail || "?").charAt(0).toUpperCase();

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-sidebar-accent">
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="bg-crayon-soft text-xs font-semibold text-ink">{initial}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-ink-soft group-data-[collapsible=icon]:hidden">
                {userEmail}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem onSelect={() => signOut(locale)} className="gap-2 text-destructive">
              <LogOut className="size-4" aria-hidden="true" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
