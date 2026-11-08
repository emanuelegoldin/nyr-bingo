import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";

interface MissingTeamGoalNoticeProps {
  isLeader: boolean;
  /** During the preparation phase the notice says a prepared resolution becomes the goal at the start. */
  inPreparation: boolean;
  /** Opens the goal dialog from the Set Goal button. */
  onSetGoal: () => void;
}

/**
 * Tells the players that the game has no team goal yet, with a Set Goal button for an admin.
 * Once a goal is set the header no longer shows it: it is on every card's goal cell.
 * Spec Reference: 16-games.md - Game Page
 * @param isLeader - Whether the caller may set the goal
 * @param inPreparation - Whether the game is in its preparation phase
 * @param onSetGoal - Opens the goal dialog
 * @returns The notice
 */
export function MissingTeamGoalNotice({ isLeader, inPreparation, onSetGoal }: MissingTeamGoalNoticeProps) {
  const t = useTranslations("Games.teamGoal");
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <p className="text-sm text-muted-foreground">
        {t("none")}
        {inPreparation && <> {t("fallbackHint")}</>}
      </p>
      {isLeader && (
        <Button variant="outline" size="sm" onClick={onSetGoal}>
          <Settings className="h-4 w-4 mr-2" /> {t("setGoal")}
        </Button>
      )}
    </div>
  );
}
