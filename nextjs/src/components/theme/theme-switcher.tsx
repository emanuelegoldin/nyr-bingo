"use client";

/**
 * Theme switcher shown in the page headers.
 * Spec Reference: 25-theming.md - Selection and Persistence
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { themes, type AppTheme } from "@/lib/theme/config";
import { cn } from "@/lib/utils";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "./theme-provider";

/** Icon shown for each theme. */
const THEME_ICONS: Record<AppTheme, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** Translation key (namespace `Nav`) of each theme's name. */
const THEME_LABEL_KEYS = {
  light: "themeLight",
  dark: "themeDark",
  system: "themeSystem",
} as const satisfies Record<AppTheme, string>;

interface ThemeSwitcherProps {
  className?: string;
}

/**
 * A button with the active theme's icon that opens the list of themes.
 *
 * @param props.className - Extra classes for the trigger button.
 * @returns The switcher.
 */
export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const t = useTranslations("Nav");
  const { theme: activeTheme, setTheme } = useTheme();
  const ActiveIcon = THEME_ICONS[activeTheme];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("px-2", className)}
          aria-label={t("theme")}
          title={t("theme")}
        >
          <ActiveIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themes.map((theme) => {
          const isActive = theme === activeTheme;
          const Icon = THEME_ICONS[theme];
          return (
            <DropdownMenuItem
              key={theme}
              className="justify-between gap-2"
              aria-current={isActive ? "true" : undefined}
              onSelect={() => {
                if (!isActive) setTheme(theme);
              }}
            >
              <span className={cn("flex items-center gap-2", isActive && "font-medium")}>
                <Icon className="h-4 w-4" />
                {t(THEME_LABEL_KEYS[theme])}
              </span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
