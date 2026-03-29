"use client";

/**
 * Resolutions Page
 * Spec Reference: 02-user-profile-and-privacy.md, 03-personal-resolutions.md
 *
 * Shows the user's personal resolutions across all types (base, compound, iterative).
 * Creation and editing are handled via the ResolutionCreateEditDialog.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSetAppHeaderTitle } from "@/components/app-header-title";
import {
  ResolutionCreateEditDialog,
  type ResolutionFormData,
} from "@/components/dialogs/resolution-create-edit-dialog";
import type { Subtask } from "@/lib/shared/types";
import { useTranslations } from "next-intl";

/* ─── Types ──────────────────────────────────────────────────────── */

type ResolutionTypeValue = "base" | "compound" | "iterative";

interface UnifiedResolution {
  id: string;
  type: ResolutionTypeValue;
  ownerUserId: string;
  title: string;
  text: string;
  subtasks?: Subtask[];
  numberOfRepetition?: number;
  completedTimes?: number;
  createdAt: string;
  updatedAt: string;
}

/** Human-readable labels for resolution types. */
const TYPE_LABELS: Record<ResolutionTypeValue, string> = {
  base: "Common",
  compound: "Complex",
  iterative: "Iterative",
};

/** Badge variant per type for visual distinction. */
const TYPE_VARIANT: Record<ResolutionTypeValue, "default" | "secondary" | "outline"> = {
  base: "secondary",
  compound: "default",
  iterative: "outline",
};

/* ─── Manager Component ──────────────────────────────────────────── */

interface ResolutionsManagerProps {
  initialResolutions: UnifiedResolution[];
}

function ResolutionsManager({ initialResolutions }: ResolutionsManagerProps) {
  const { toast } = useToast();
  const t = useTranslations("ResolutionsPage");
  const [resolutions, setResolutions] = useState<UnifiedResolution[]>(initialResolutions);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResolution, setEditingResolution] = useState<ResolutionFormData | undefined>(undefined);

  /** Fetch all resolution types from the unified endpoint. */
  const loadResolutions = useCallback(async () => {
    try {
      const response = await fetch("/api/resolutions/all");
      const data = await response.json();
      if (response.ok) {
        setResolutions(data.resolutions || []);
      }
    } catch {
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
    setEditingResolution({
      id: res.id,
      type: res.type,
      title: res.title,
      text: res.text,
      subtasks: res.subtasks,
      numberOfRepetition: res.numberOfRepetition,
    });
    setDialogOpen(true);
  };

  /**
   * Delete a resolution using the appropriate type-specific endpoint.
   * Base resolutions use /api/resolutions, compound/iterative use their own routes.
   */
  const handleDelete = async (res: UnifiedResolution) => {
    setDeletingId(res.id);
    try {
      let url: string;
      switch (res.type) {
        case "compound":
          url = `/api/resolutions/compound?id=${res.id}`;
          break;
        case "iterative":
          url = `/api/resolutions/iterative?id=${res.id}`;
          break;
        default:
          url = `/api/resolutions?id=${res.id}`;
      }

      const response = await fetch(url, { method: "DELETE" });

      if (response.ok) {
        setResolutions((prev) => prev.filter((r) => r.id !== res.id));
        toast({ title: "Success", description: "Resolution deleted" });
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to delete resolution",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
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
            <CardTitle className="font-headline">{t("title")}</CardTitle>
            <CardDescription>
              {t("description")}
            </CardDescription>
          </div>
          <Button size="icon" onClick={handleCreate} aria-label="Add resolution">
            <Plus className="h-4 w-4" />
          </Button>
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
                    <Badge variant={TYPE_VARIANT[res.type]} className="text-xs flex-shrink-0">
                      {TYPE_LABELS[res.type]}
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
                    onClick={() => handleEdit(res)}
                    disabled={deletingId === res.id}
                    aria-label="Edit resolution"
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
  useSetAppHeaderTitle(t("headerTitle"));

  return (
    <div className="space-y-6">
      <ResolutionsManager initialResolutions={initialResolutions} />
    </div>
  );
}
