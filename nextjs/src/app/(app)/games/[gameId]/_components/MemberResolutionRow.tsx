/**
 * One teammate in the Teammates tab: the caller's resolution for them, or a prompt to write one.
 * Spec Reference: 12-team-tabs.md - Teammates Tab
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RESOLUTION_TYPE_BADGE_VARIANTS } from "@/lib/shared/resolution-type";
import type { ResolutionTypeValue } from "@/lib/shared/types";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TeamProvidedResolution } from "../types";

interface MemberResolutionRowProps {
  memberName: string;
  resolution: TeamProvidedResolution | null;
  onEdit: () => void;
}

/**
 * Show the teammate's name and the resolution written for them (title and type badge), with a button to write or
 * edit it.
 */
export function MemberResolutionRow({ memberName, resolution, onEdit }: MemberResolutionRowProps) {
  const tl = useTranslations("Labels");
  const t = useTranslations("Games.teammatesTab");
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t("forMember", { name: memberName })}</p>
        {resolution ? (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm truncate">{resolution.title}</span>
            <Badge
              variant={RESOLUTION_TYPE_BADGE_VARIANTS[resolution.resolutionType as ResolutionTypeValue]}
              className="text-xs flex-shrink-0"
            >
              {tl(`resolutionType.${resolution.resolutionType as ResolutionTypeValue}`)}
            </Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">{t("noneYet")}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"
        onClick={onEdit}
        aria-label={resolution ? t("edit") : t("add")}
      >
        {resolution ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}
