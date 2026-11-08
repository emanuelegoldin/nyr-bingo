"use client";

/**
 * The Teammates tab: every other player with the resolution the caller writes for them, and the dialog to write it.
 * Spec Reference: 12-team-tabs.md - Teammates Tab, 16-games.md - Member-Provided Resolutions
 */

import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolutionToFormData } from "@/lib/shared/resolution-form";
import type { ResolutionFormData } from "@/lib/shared/types";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Game, TeamProvidedResolution } from "../types";
import { MemberResolutionRow } from "./MemberResolutionRow";

interface TeammatesTabProps {
  game: Game;
  currentUserId: string;
  /** The member-provided resolutions the caller wrote in this game */
  existingResolutions: TeamProvidedResolution[];
  /** Reloads the page after a save */
  onReload: () => void;
}

/** The teammate whose resolution is being written. */
interface EditingMember {
  userId: string;
  name: string;
  data: ResolutionFormData | undefined;
}

/**
 * List the other players with the caller's resolution for each, and open the resolution dialog for one of them.
 */
export function TeammatesTab({ game, currentUserId, existingResolutions, onReload }: TeammatesTabProps) {
  const t = useTranslations("Games.teammatesTab");
  const [editing, setEditing] = useState<EditingMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const teammates = game.members.filter((member) => member.user.userId !== currentUserId);

  /**
   * Open the dialog for a teammate, with the caller's existing resolution for them if any.
   * @param userId The teammate
   * @param name Their display name
   */
  const handleEdit = (userId: string, name: string) => {
    const existing = existingResolutions.find((resolution) => resolution.toUserId === userId);
    setEditing({ userId, name, data: existing ? resolutionToFormData(existing) : undefined });
    setDialogOpen(true);
  };

  /** Close the dialog and reload, so the row shows the saved resolution. */
  const handleSaved = () => {
    setDialogOpen(false);
    onReload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {teammates.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-4">{t("empty")}</p>
        )}
        {teammates.map((member) => {
          const name = member.user.displayName || member.user.username;
          return (
            <MemberResolutionRow
              key={member.user.userId}
              memberName={name}
              resolution={existingResolutions.find((resolution) => resolution.toUserId === member.user.userId) ?? null}
              onEdit={() => handleEdit(member.user.userId, name)}
            />
          );
        })}
      </CardContent>

      {editing && (
        <ResolutionCreateEditDialog
          initialData={editing.data}
          isOpen={dialogOpen}
          setIsOpen={setDialogOpen}
          onSaved={handleSaved}
          scope="member_provided"
          gameId={game.id}
          toUserId={editing.userId}
          recipientName={editing.name}
        />
      )}
    </Card>
  );
}
