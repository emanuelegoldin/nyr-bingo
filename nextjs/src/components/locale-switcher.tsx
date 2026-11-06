"use client";

/**
 * Language switcher shown in the page headers (spec 15).
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localeNames, locales } from "@/i18n/config";
import { useSetLocale } from "@/i18n/use-set-locale";
import { cn } from "@/lib/utils";
import { Check, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ThemeSwitcher } from "./theme/theme-switcher";

interface LocaleSwitcherProps {
  className?: string;
}

/**
 * A globe button with the active locale code that opens the list of languages.
 * On narrow screens only the globe is shown.
 *
 * @param props.className - Extra classes for the trigger button.
 * @returns The switcher.
 */
export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const t = useTranslations("Nav");
  const activeLocale = useLocale();
  const setLocale = useSetLocale();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5 px-2", className)}
          aria-label={t("language")}
          title={t("language")}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">
            {activeLocale}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((locale) => {
          const isActive = locale === activeLocale;
          return (
            <DropdownMenuItem
              key={locale}
              lang={locale}
              className="justify-between gap-2"
              aria-current={isActive ? "true" : undefined}
              onSelect={() => {
                if (!isActive) setLocale(locale);
              }}
            >
              <span className={cn(isActive && "font-medium")}>{localeNames[locale]}</span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The theme and language switchers pinned to the top right of a page that has no header
 * (login, registration, invitation and verification pages; specs 15 and 25).
 *
 * @returns The pinned switchers.
 */
export function CornerLocaleSwitcher() {
  return (
    <div className="fixed right-4 top-4 z-20 flex items-center">
      <ThemeSwitcher />
      <LocaleSwitcher />
    </div>
  );
}
