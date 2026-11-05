"use client";

import { AppLogo } from "@/components/icons";
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Archive,
  LayoutGrid,
  ListCheck,
  Swords,
  User,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  {
    href: "/dashboard",
    labelKey: "dashboard",
    icon: LayoutGrid,
  },
  {
    href: "/games",
    labelKey: "games",
    icon: Swords,
  },
  {
    href: "/teams",
    labelKey: "teams",
    icon: Users,
  },
  {
    href: "/profile",
    labelKey: "profile",
    icon: User,
  },
  {
    href: "/resolutions",
    labelKey: "resolutions",
    icon: ListCheck,
  },
  {
    href: "/archive",
    labelKey: "archive",
    icon: Archive,
  }
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const t = useTranslations("Nav");

  /**
   * Close the mobile drawer once a destination is chosen.
   * Spec: 20-mobile-layout.md - Navigation Drawer
   */
  const closeMobileSidebar = () => {
    setOpenMobile(false);
  };

  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2" onClick={closeMobileSidebar}>
          <AppLogo />
          <span className="text-lg font-semibold font-headline">Resolution Bingo</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                tooltip={t(item.labelKey)}
              >
                <Link href={item.href} onClick={closeMobileSidebar}>
                  <item.icon />
                  <span>{t(item.labelKey)}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter />
    </>
  );
}
