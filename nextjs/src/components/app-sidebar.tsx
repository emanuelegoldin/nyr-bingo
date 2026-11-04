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
  User,
  Users,
  Swords,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSelectorDropdown } from "./LanguageSelectorDropdown";

const menuItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
  },
  {
    href: "/games",
    label: "Games",
    icon: Swords,
  },
  {
    href: "/teams",
    label: "Teams",
    icon: Users,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
  },
  {
    href: "/resolutions",
    label: "Resolutions",
    icon: ListCheck,
  },
  {
    href: "/archive",
    label: "Archive",
    icon: Archive,
  }
];

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

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
                tooltip={item.label}
              >
                <Link href={item.href} onClick={closeMobileSidebar}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <LanguageSelectorDropdown />
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter />
    </>
  );
}
