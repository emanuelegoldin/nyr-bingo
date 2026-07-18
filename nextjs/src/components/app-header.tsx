"use client";

import { useAppHeaderTitle } from "@/components/app-header-title";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserAvatarButton } from "./user-avatar-button";

export function AppHeader() {

  const { title: headerTitle } = useAppHeaderTitle();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl font-headline">
          {headerTitle}
        </h1>
      </div>
      <div className="ml-auto">
        <UserAvatarButton />
      </div>
    </header>
  );
}
