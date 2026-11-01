"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppContext } from "@/hooks/AppContext";
import { useNotificationSocket } from "@/hooks/use-notification-socket";
import { getDictionaryForLocale } from "@/i18n/dictionary";
import { apiFetch } from "@/lib/api-client";
import type { UserNotification } from "@/lib/notifications/types";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NotificationItem } from "./notification-item";

const MAX_BADGE_COUNT = 99;

/** The bell in the application header, with the unread count and the list (spec 19). */
export function NotificationBell() {
  const router = useRouter();
  const { language } = useAppContext();
  const strings = getDictionaryForLocale(language).Notifications;
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    const result = await apiFetch<{ notifications: UserNotification[]; unreadCount: number }>("/api/notifications");
    if (result.ok) {
      setNotifications(result.data.notifications);
      setUnreadCount(result.data.unreadCount);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useNotificationSocket(loadNotifications);

  const handleSelect = async (notification: UserNotification) => {
    if (!notification.read) {
      await apiFetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
      await loadNotifications();
    }
    if (notification.link) router.push(notification.link);
  };

  const handleMarkAllRead = async () => {
    await apiFetch("/api/notifications/read-all", { method: "POST" });
    await loadNotifications();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={strings.open}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-xs">
              {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between gap-2">
          <DropdownMenuLabel>{strings.title}</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              {strings.markAllRead}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{strings.empty}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                strings={strings}
                locale={language}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
