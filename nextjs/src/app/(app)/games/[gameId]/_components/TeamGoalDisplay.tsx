import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RESOLUTION_TYPE_BADGE_VARIANTS, RESOLUTION_TYPE_LABELS } from "@/lib/shared/resolution-type";
import type { ResolutionFormData } from "@/lib/shared/types";
import { Pencil } from "lucide-react";

interface TeamGoalDisplayProps {
  goal: ResolutionFormData | null;
  isLeader: boolean;
  onEdit: () => void;
}

/**
 * Shows the team goal inline. Leader sees an edit button.
 * All members see the title, type badge, description, and type-specific details.
 */
export function TeamGoalDisplay({ goal, isLeader, onEdit }: TeamGoalDisplayProps) {
  if (!goal) {
    return (
      <p className="text-sm text-muted-foreground">
        {isLeader
          ? 'No team goal set yet. Click "Set Goal" to define one.'
          : "No team goal set yet."}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Team Goal:</span>
        <span className="text-sm font-medium">{goal.title}</span>
        <Badge variant={RESOLUTION_TYPE_BADGE_VARIANTS[goal.type]} className="text-xs">
          {RESOLUTION_TYPE_LABELS[goal.type]}
        </Badge>
        {isLeader && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label="Edit team goal"
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
          {goal.subtasks.filter(s => s.completed).length} / {goal.subtasks.length} subtasks
        </p>
      )}
      {goal.type === "iterative" && goal.numberOfRepetition !== undefined && (
        <p className="text-xs text-muted-foreground">
          Target: {goal.numberOfRepetition} repetitions
        </p>
      )}
    </div>
  );
}
