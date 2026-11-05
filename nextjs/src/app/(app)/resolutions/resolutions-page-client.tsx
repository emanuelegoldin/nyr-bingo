"use client";

/**
 * Resolutions Page
 * Spec Reference: 02-user-profile-and-privacy.md, 03-personal-resolutions.md
 *
 * Shows the user's personal resolutions across all types (base, compound, iterative).
 * Creation and editing are handled via the ResolutionCreateEditDialog.
 */

import { PreparedResolutionsDialog } from "@/components/dialogs/prepared-resolutions-dialog";
import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { unifiedToFormData } from "@/lib/shared/resolution-form";
import { RESOLUTION_TYPE_BADGE_VARIANTS } from "@/lib/shared/resolution-type";
import type { ResolutionFormData, UnifiedResolution } from "@/lib/shared/types";
import { Lightbulb, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

/* ─── Manager Component ──────────────────────────────────────────── */

interface ResolutionsManagerProps {
  initialResolutions: UnifiedResolution[];
  t: ReturnType<typeof useTranslations<"ResolutionsPage">>;
}

function ResolutionsManager({ initialResolutions, t }: ResolutionsManagerProps) {
  const tl = useTranslations("Labels");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  const { toast } = useToast();
  const [resolutions, setResolutions] = useState<UnifiedResolution[]>(initialResolutions);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResolution, setEditingResolution] = useState<ResolutionFormData | undefined>(undefined);
  const [browseOpen, setBrowseOpen] = useState(false);

  /** Fetch all resolution types from the unified endpoint. */
  const loadResolutions = useCallback(async () => {
    const result = await apiFetch<{ resolutions?: UnifiedResolution[] }>("/api/resolutions/all");
    if (result.ok) {
      setResolutions(result.data.resolutions || []);
    } else if (result.status === 0) {
      // No usable response (network failure or non-JSON body)
      toast({
        title: tc("error"),
        description: t("loadError"),
        variant: "destructive",
      });
    }
  }, [toast, tc, t]);

  /** Open dialog in create mode. */
  const handleCreate = () => {
    setEditingResolution(undefined);
    setDialogOpen(true);
  };

  /** Open dialog in edit mode with existing data. */
  const handleEdit = (res: UnifiedResolution) => {
    setEditingResolution(unifiedToFormData(res));
    setDialogOpen(true);
  };

  /**
   * Delete a resolution through the generic endpoint, which accepts every type.
   */
  const handleDelete = async (res: UnifiedResolution) => {
    setDeletingId(res.id);
    const url = `/api/resolutions?id=${res.id}`;

    const result = await apiFetch<unknown>(url, { method: "DELETE" });

    if (result.ok) {
      setResolutions((prev) => prev.filter((r) => r.id !== res.id));
      toast({ title: tc("success"), description: t("deleted") });
    } else {
      toastApiError(result, t("deleteError"));
    }
    setDeletingId(null);
  };

  /** Called when a resolution is saved (created or updated) via the dialog. */
  const handleSaved = () => {
    // Reload the full list to keep it in sync (type changes, etc.)
    loadResolutions();
  };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="font-headline">{t('title')}</CardTitle>
            <CardDescription>
              {t('description')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setBrowseOpen(true)}>
              <Lightbulb className="h-4 w-4 mr-2" />
              {t('browseIdeas')}
            </Button>
            <Button size="icon" onClick={handleCreate} aria-label={t("addAriaLabel")}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Separator />
          <ul className="space-y-2">
            {resolutions.map((res) => (
              <li
                key={res.id}
                className="flex items-center justify-between p-2 rounded-md bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:flex-nowrap">
                    <span className="min-w-0 text-sm font-medium break-words md:truncate">{res.title}</span>
                    <Badge variant={RESOLUTION_TYPE_BADGE_VARIANTS[res.type]} className="text-xs flex-shrink-0">
                      {tl(`resolutionType.${res.type}`)}
                    </Badge>
                  </div>
                  {res.text && res.text !== res.title && (
                    <span className="text-xs text-muted-foreground block truncate mt-0.5">
                      {res.text}
                    </span>
                  )}
                  {/* Compound: show subtask count */}
                  {res.type === "compound" && res.subtasks && (
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {t("subtaskCount", { count: res.subtasks.length })}
                    </span>
                  )}
                  {/* Iterative: show the target */}
                  {res.type === "iterative" && res.numberOfRepetition !== undefined && (
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {t("repetitionTarget", { count: res.numberOfRepetition })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleEdit(res)}
                    disabled={deletingId === res.id}
                    aria-label={t('editAriaLabel')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(res)}
                    disabled={deletingId === res.id}
                    aria-label={t('deleteAriaLabel')}
                  >
                    {deletingId === res.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
            {resolutions.length === 0 && (
              <p className="text-sm text-center text-muted-foreground py-4">
                {t('empty')}
              </p>
            )}
          </ul>
        </CardContent>
      </Card>

      <ResolutionCreateEditDialog
        key={editingResolution?.id ?? "create"}
        initialData={editingResolution}
        isOpen={dialogOpen}
        setIsOpen={setDialogOpen}
        onSaved={handleSaved}
      />

      <PreparedResolutionsDialog
        personalResolutions={resolutions}
        isOpen={browseOpen}
        setIsOpen={setBrowseOpen}
        onAdded={loadResolutions}
      />
    </>
  );
}

interface ResolutionsPageClientProps {
  initialResolutions: UnifiedResolution[];
}

export default function ResolutionsPageClient({
  initialResolutions,
}: ResolutionsPageClientProps) {
  const t = useTranslations("ResolutionsPage");

  usePageTitle(t('headerTitle'));

  return (
    <div className="space-y-6">
      <ResolutionsManager initialResolutions={initialResolutions} t={t} />
    </div>
  );
}
