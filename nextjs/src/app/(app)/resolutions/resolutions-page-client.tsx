"use client";

/**
 * Resolutions Page
 * Spec Reference: 02-user-profile-and-privacy.md, 03-personal-resolutions.md
 *
 * Shows the user's personal resolutions across all types (base, compound, iterative).
 * Creation and editing are handled via the ResolutionCreateEditDialog.
 */

import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { PreparedResolutionsDialog } from "@/components/dialogs/prepared-resolutions-dialog";
import { ResolutionHistoryDialog } from "@/components/dialogs/resolution-history-dialog";
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
import { useAppContext, usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getDictionaryForLocale } from "@/i18n/dictionary";
import { apiFetch } from "@/lib/api-client";
import { unifiedToFormData } from "@/lib/shared/resolution-form";
import { RESOLUTION_TYPE_BADGE_VARIANTS, RESOLUTION_TYPE_LABELS } from "@/lib/shared/resolution-type";
import type { ResolutionFormData, ResolutionTypeValue, UnifiedResolution } from "@/lib/shared/types";
import { History, Lightbulb, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

/* ─── Types ──────────────────────────────────────────────────────── */

/** Type-specific DELETE endpoint per resolution type (base uses the generic route). */
const DELETE_ENDPOINTS: Record<ResolutionTypeValue, string> = {
  base: "/api/resolutions",
  compound: "/api/resolutions/compound",
  iterative: "/api/resolutions/iterative",
};

/* ─── Manager Component ──────────────────────────────────────────── */

interface ResolutionsManagerProps {
  initialResolutions: UnifiedResolution[];
  t: ReturnType<typeof getDictionaryForLocale>["ResolutionsPage"];
}

function ResolutionsManager({ initialResolutions, t }: ResolutionsManagerProps) {
  const { toast } = useToast();
  const [resolutions, setResolutions] = useState<UnifiedResolution[]>(initialResolutions);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResolution, setEditingResolution] = useState<ResolutionFormData | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyResolution, setHistoryResolution] = useState<{ id: string; title: string } | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  /** Fetch all resolution types from the unified endpoint. */
  const loadResolutions = useCallback(async () => {
    const result = await apiFetch<{ resolutions?: UnifiedResolution[] }>("/api/resolutions/all");
    if (result.ok) {
      setResolutions(result.data.resolutions || []);
    } else if (result.status === 0) {
      // No usable response (network failure or non-JSON body)
      toast({
        title: "Error",
        description: "Failed to load resolutions",
        variant: "destructive",
      });
    }
  }, [toast]);

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

  const handleViewHistory = (res: UnifiedResolution) => {
    setHistoryResolution({ id: res.id, title: res.title });
    setHistoryOpen(true);
  };

  /**
   * Delete a resolution using the appropriate type-specific endpoint.
   * Base resolutions use /api/resolutions, compound/iterative use their own routes.
   */
  const handleDelete = async (res: UnifiedResolution) => {
    setDeletingId(res.id);
    const url = `${DELETE_ENDPOINTS[res.type] ?? DELETE_ENDPOINTS.base}?id=${res.id}`;

    const result = await apiFetch<unknown>(url, { method: "DELETE" });

    if (result.ok) {
      setResolutions((prev) => prev.filter((r) => r.id !== res.id));
      toast({ title: "Success", description: "Resolution deleted" });
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || "Failed to delete resolution",
        variant: "destructive",
      });
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
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="font-headline">{t.title}</CardTitle>
            <CardDescription>
              {t.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setBrowseOpen(true)}>
              <Lightbulb className="h-4 w-4 mr-2" />
              {t.browseIdeas}
            </Button>
            <Button size="icon" onClick={handleCreate} aria-label="Add resolution">
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{res.title}</span>
                    <Badge variant={RESOLUTION_TYPE_BADGE_VARIANTS[res.type]} className="text-xs flex-shrink-0">
                      {RESOLUTION_TYPE_LABELS[res.type]}
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
                      {res.subtasks.filter((s) => s.completed).length} / {res.subtasks.length} subtasks
                    </span>
                  )}
                  {/* Iterative: show progress */}
                  {res.type === "iterative" &&
                    res.numberOfRepetition !== undefined &&
                    res.completedTimes !== undefined && (
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        {res.completedTimes} / {res.numberOfRepetition} repetitions
                      </span>
                    )}
                </div>

                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleViewHistory(res)}
                    disabled={deletingId === res.id}
                    aria-label={t.viewHistoryAriaLabel}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleEdit(res)}
                    disabled={deletingId === res.id}
                    /*TODO: check label*/
                    aria-label={t.viewHistoryAriaLabel}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(res)}
                    disabled={deletingId === res.id}
                    aria-label="Delete resolution"
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
                You haven&apos;t added any resolutions yet. Click the + button to create one.
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

      {historyResolution && (
        <ResolutionHistoryDialog
          resolutionId={historyResolution.id}
          resolutionTitle={historyResolution.title}
          isOpen={historyOpen}
          setIsOpen={setHistoryOpen}
        />
      )}
    </>
  );
}

interface ResolutionsPageClientProps {
  initialResolutions: UnifiedResolution[];
}

export default function ResolutionsPageClient({
  initialResolutions,
}: ResolutionsPageClientProps) {
  const { language } = useAppContext();
  const t = getDictionaryForLocale(language).ResolutionsPage;

  usePageTitle(t.headerTitle);

  return (
    <div className="space-y-6">
      <ResolutionsManager initialResolutions={initialResolutions} t={t} />
    </div>
  );
}
