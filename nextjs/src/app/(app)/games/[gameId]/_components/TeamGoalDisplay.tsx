import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RESOLUTION_TYPE_BADGE_VARIANTS } from "@/lib/shared/resolution-type";
import type { ResolutionFormData } from "@/lib/shared/types";
import { Pencil, Settings } from "lucide-react";
import { useTranslations } from "next-intl";

interface TeamGoalDisplayProps {
  goal: ResolutionFormData | null;
  isLeader: boolean;
  onEdit: () => void;
}

/**
 * Shows the team goal inline. A leader sees a Set Goal button while no goal is set, and an
 * edit button once it is.
 * Spec Reference: 16-games.md - Game Page
 * All members see the title, type badge, description, and type-specific details.
 */
export function TeamGoalDisplay({ goal, isLeader, onEdit }: TeamGoalDisplayProps) {
  const tl = useTranslations("Labels");
  const t = useTranslations("Games.teamGoal");
  if (!goal) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{t("none")}</p>
        {isLeader && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Settings className="h-4 w-4 mr-2" /> {t("setGoal")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{t("label")}</span>
        <span className="text-sm font-medium">{goal.title}</span>
        <Badge variant={RESOLUTION_TYPE_BADGE_VARIANTS[goal.type]} className="text-xs">
          {tl(`resolutionType.${goal.type}`)}
        </Badge>
        {isLeader && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label={t("edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {goal.text && goal.text !== goal.title && (
        <p className="text-xs text-muted-foreground">{goal.text}</p>
      )}
      {goal.type === "compound" && goal.subtasks && (
        <p className="text-xs text-muted-foreground">
          {t("subtasks", { done: goal.subtasks.filter(s => s.completed).length, total: goal.subtasks.length })}
        </p>
      )}
      {goal.type === "iterative" && goal.numberOfRepetition !== undefined && (
        <p className="text-xs text-muted-foreground">
          {t("target", { count: goal.numberOfRepetition })}
        </p>
      )}
    </div>
  );
}
