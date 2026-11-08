"use client";

/**
 * Resolutions Page - the obsolete, read-only list of legacy personal resolutions, with a notice and Delete only.
 * Spec Reference: 03-personal-resolutions.md - Legacy Personal Resolutions
 *
 * LEGACY-PERSONAL-RESOLUTIONS: remove this page (and its sidebar link) after 2027-05-08.
 */

import { ResolutionList } from "@/components/resolutions/resolution-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePageTitle } from "@/hooks/AppContext";
import type { UnifiedResolution } from "@/lib/shared/types";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

interface ResolutionsPageClientProps {
  /** The user's legacy personal resolutions, newest first */
  resolutions: UnifiedResolution[];
}

/**
 * Show the obsolescence notice and the legacy resolutions, which can only be deleted.
 */
export default function ResolutionsPageClient({ resolutions }: ResolutionsPageClientProps) {
  const t = useTranslations("ResolutionsPage");
  const router = useRouter();

  usePageTitle(t("headerTitle"));

  return (
    <div className="space-y-6">
      <Card className="border-warning">
        <CardContent className="flex gap-3 pt-6">
          <TriangleAlert className="h-5 w-5 flex-shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("obsoleteTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("obsoleteNotice")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResolutionList resolutions={resolutions} emptyText={t("empty")} onDeleted={() => router.refresh()} />
        </CardContent>
      </Card>
    </div>
  );
}
