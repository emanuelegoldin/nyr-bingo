"use client";

/**
 * Client side of the Guides page: its title and the list of guides.
 * Spec Reference: 26-guided-tour.md - Guides Page
 */

import { GuideList } from "@/components/guide/guide-list";
import { usePageTitle } from "@/hooks/AppContext";
import { useTranslations } from "next-intl";

/**
 * Sets the page title and lists the guides.
 *
 * @returns The Guides page content.
 */
export default function GuidesPageClient() {
  const t = useTranslations("Guide");
  usePageTitle(t("page.title"));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t("page.heading")}</h1>
        <p className="text-muted-foreground">{t("page.intro")}</p>
      </div>
      <GuideList />
    </div>
  );
}
