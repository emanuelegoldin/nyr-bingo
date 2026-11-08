"use client";

/**
 * The Personal tab: the caller's own resolutions for the game, with a y/target counter, Add and Browse ideas.
 * Spec Reference: 12-team-tabs.md - Personal Tab, 03-personal-resolutions.md - Personal Target, Create Dialog
 */

import { PreparedResolutionsDialog } from "@/components/dialogs/prepared-resolutions-dialog";
import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { ResolutionList } from "@/components/resolutions/resolution-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPersonalResolutionTarget } from "@/lib/shared/personal-target";
import { unifiedToFormData } from "@/lib/shared/resolution-form";
import type { ResolutionFormData, UnifiedResolution } from "@/lib/shared/types";
import { Lightbulb, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Game } from "../types";

interface PersonalTabProps {
  game: Game;
  /** The caller's personal resolutions of the game, newest first */
  resolutions: UnifiedResolution[];
  /** Reloads the page after a change, which updates the list and the counter */
  onReload: () => void;
}

/**
 * Show the counter, the Add and Browse ideas buttons and the caller's resolutions with Edit and Delete.
 */
export function PersonalTab({ game, resolutions, onReload }: PersonalTabProps) {
  const t = useTranslations("Games.personalTab");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ResolutionFormData | undefined>(undefined);
  const [browseOpen, setBrowseOpen] = useState(false);

  const target = getPersonalResolutionTarget(game.gridSize, game.members.length);

  /** Open the dialog with an empty form. */
  const handleCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  /**
   * Open the dialog with a resolution to edit.
   * @param resolution The resolution
   */
  const handleEdit = (resolution: UnifiedResolution) => {
    setEditing(unifiedToFormData(resolution));
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="font-headline">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => setBrowseOpen(true)}>
            <Lightbulb className="h-4 w-4 mr-2" />
            {t("browseIdeas")}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("add")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-2xl font-semibold" aria-live="polite">
            {resolutions.length}/{target}{" "}
            <span className="text-sm font-normal text-muted-foreground">{t("counterLabel")}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t("counterHint", { target })}</p>
        </div>

        <ResolutionList
          resolutions={resolutions}
          emptyText={t("empty")}
          onEdit={handleEdit}
          onDeleted={onReload}
        />
      </CardContent>

      <ResolutionCreateEditDialog
        initialData={editing}
        isOpen={dialogOpen}
        setIsOpen={setDialogOpen}
        onSaved={onReload}
        scope="personal"
        gameId={game.id}
      />

      <PreparedResolutionsDialog
        gameId={game.id}
        personalResolutions={resolutions}
        isOpen={browseOpen}
        setIsOpen={setBrowseOpen}
        onAdded={onReload}
      />
    </Card>
  );
}
