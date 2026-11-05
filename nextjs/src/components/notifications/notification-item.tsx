"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { formatRelativeTime, notificationText } from "@/lib/notifications/text";
import type { UserNotification } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

interface NotificationItemProps {
  notification: UserNotification;
  onSelect: (notification: UserNotification) => void;
}

/** One line of the notification list. */
export function NotificationItem({ notification, onSelect }: NotificationItemProps) {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const placeName = notification.gameName ?? notification.teamName;

  return (
    <DropdownMenuItem
      className="flex cursor-pointer items-start gap-2"
      onSelect={() => onSelect(notification)}
    >
      <span
        aria-hidden
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", !notification.read && "bg-primary")}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", !notification.read && "font-medium")}>
          {notificationText(notification, t)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {placeName} · {formatRelativeTime(notification.createdAt, locale)}
        </span>
      </span>
    </DropdownMenuItem>
  );
}
