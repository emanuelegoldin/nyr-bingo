"use client";

/**
 * User Avatar Button Component
 */

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

interface UserInfo {
  id: string;
  username: string;
  email: string;
}

export function UserAvatarButton() {
  const router = useRouter();
  const { toast } = useToast();
  const toastApiError = useApiErrorToast();
  const t = useTranslations("Nav");
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    async function loadUser() {
      // Silently fail - user might not be logged in
      const result = await apiFetch<{ user?: UserInfo }>('/api/profile');
      if (result.ok && result.data.user) {
        setUser(result.data.user);
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    const result = await apiFetch<unknown>('/api/auth/logout', { method: 'POST' });
    if (!result.ok) {
      toastApiError(result, t("logoutFailed"));
      return;
    }
    toast({
      title: t("loggedOutTitle"),
      description: t("loggedOutDescription"),
    });
    router.push('/');
  };

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">{t("login")}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label={t("userMenu")}>
          <Avatar className="h-9 w-9">
            <AvatarFallback>{user.username?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">{t("profile")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/teams">{t("teams")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
