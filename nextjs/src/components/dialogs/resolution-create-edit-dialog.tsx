/**
 * Resolution Create/Edit Dialog
 * A unified dialog for creating and editing personal resolutions of all types.
 *
 * Features:
 * - Title input + type dropdown in the header
 * - Description textarea shared across all types
 * - Type-specific sections kept mounted but hidden (preserves state on type switch)
 * - Subtask list management for compound resolutions
 * - Number of repetitions input for iterative resolutions
 * - Reusable for both create and edit flows
 */

"use client";

import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { RESOLUTION_TYPE_LABELS } from "@/lib/shared/resolution-type";
import type { ResolutionFormData, ResolutionTypeValue, Subtask } from "@/lib/shared/types";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { CompoundSubtaskEditor } from "./resolution-form/compound-subtask-editor";
import { IterativeRepetitionInput } from "./resolution-form/iterative-repetition-input";

/* ─── Types ──────────────────────────────────────────────────────── */

interface ResolutionCreateEditDialogProps {
  /** If provided, the dialog is in edit mode with pre-filled data. */
  initialData?: ResolutionFormData;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** Called after a successful save. */
  onSaved?: () => void;
  /** Resolution scope. Defaults to 'personal'. */
  scope?: "personal" | "team" | "member_provided";
  /** Required when scope is 'team' or 'member_provided'. */
  gameId?: string;
  /** Required when scope is 'member_provided'. */
  toUserId?: string;
  /** Display name of the recipient (for member_provided scope). */
  recipientName?: string;
}

/**
 * Builds the dialog title and description for a scope and mode.
 *
 * @param scope - Resolution scope of the dialog.
 * @param isEdit - True when an existing resolution is edited.
 * @param recipientName - Display name of the recipient (member_provided scope).
 * @returns The title and description to show in the dialog header.
 */
const dialogCopy = (
  scope: "personal" | "team" | "member_provided",
  isEdit: boolean,
  recipientName?: string,
): { title: string; description: string } => {
  if (scope === "team") {
    return {
      title: isEdit ? "Edit Team Goal" : "Set Team Goal",
      description: "Set the team goal that will appear on everyone's bingo card.",
    };
  }
  if (scope === "member_provided") {
    return {
      title: isEdit
        ? `Edit Resolution for ${recipientName ?? "Member"}`
        : `New Resolution for ${recipientName ?? "Member"}`,
      description: `Create a resolution for ${recipientName ?? "this member"}.`,
    };
  }
  return {
    title: isEdit ? "Edit Resolution" : "New Resolution",
    description: isEdit ? "Update the resolution details below." : "Create a new personal resolution.",
  };
};

/* ─── Component ──────────────────────────────────────────────────── */

/**
 * Dialog for creating or editing a personal resolution.
 * Supports all three resolution types and preserves field state when switching types.
 */
export const ResolutionCreateEditDialog = ({
  initialData,
  isOpen,
  setIsOpen,
  onSaved,
  scope = "personal",
  gameId,
  toUserId,
  recipientName,
}: ResolutionCreateEditDialogProps) => {
  const { toast } = useToast();
  const isEdit = Boolean(initialData?.id);

  // ── Common fields ────────────────────────────────────────────
  const [type, setType] = useState<ResolutionTypeValue>(initialData?.type ?? "base");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [text, setText] = useState(initialData?.text ?? "");

  // ── Compound fields ──────────────────────────────────────────
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialData?.subtasks ?? []);

  // ── Iterative fields ─────────────────────────────────────────
  const [numberOfRepetition, setNumberOfRepetition] = useState<number>(
    initialData?.numberOfRepetition ?? 2
  );

  const [isSaving, setIsSaving] = useState(false);

  /** Original type (for detecting type changes on edit). */

  const canSave = () => {
    if (!title.trim()) return false;
    if (type === "compound" && subtasks.length === 0) return false;
    if (type === "iterative" && (numberOfRepetition < 2 || !Number.isInteger(numberOfRepetition))) return false;
    return true;
  };

  const handleSave = useCallback(async () => {
    if (!canSave() || isSaving) return;
    setIsSaving(true);

    try {
      const body: Record<string, unknown> = {
        type,
        title: title.trim(),
        text: text.trim() || undefined,
      };

      if (scope !== "personal") {
        body.scope = scope;
        if (gameId) body.gameId = gameId;
        if (toUserId) body.toUserId = toUserId;
      }

      if (isEdit && initialData?.id) {
        body.id = initialData.id;
      }

      if (type === "compound") {
        body.subtasks = subtasks;
      }
      if (type === "iterative") {
        body.numberOfRepetition = numberOfRepetition;
      }

      const result = await apiFetch<unknown>("/api/resolutions/save", {
        method: "POST",
        json: body,
      });

      if (!result.ok) {
        toast({
          title: "Error",
          description: result.status === 0 ? "An error occurred while saving" : result.error || "Failed to save resolution",
          variant: "destructive",
        });
        return;
      }

      onSaved?.();

      setIsOpen(false);
      toast({
        title: "Success",
        description: isEdit ? "Resolution updated" : "Resolution created",
      });
    } catch {
      toast({
        title: "Error",
        description: "An error occurred while saving",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, title, text, subtasks, numberOfRepetition, isSaving, initialData, isEdit, scope, gameId, toUserId]);

  const copy = dialogCopy(scope, isEdit, recipientName);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {copy.title}
          </DialogTitle>
          <DialogDescription>
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        {/* ── Title + Type row ──────────────────────────────────── */}
        <div className="flex gap-2 items-start">
          <Input
            className="flex-1"
            placeholder="Resolution title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSaving}
            autoFocus
          />
          <Select value={type} onValueChange={(v) => setType(v as ResolutionTypeValue)}>
            <SelectTrigger className="w-[140px]" disabled={isSaving}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">{RESOLUTION_TYPE_LABELS.base}</SelectItem>
              <SelectItem value="compound">{RESOLUTION_TYPE_LABELS.compound}</SelectItem>
              <SelectItem value="iterative">{RESOLUTION_TYPE_LABELS.iterative}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Description ───────────────────────────────────────── */}
        <Textarea
          placeholder="Description (optional)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSaving}
          rows={3}
        />

        {/* ── Type-specific sections ────────────────────────────── */}
        {/* Sections stay mounted (hidden via CSS) to preserve state when switching types */}
        <div className={type !== "compound" ? "hidden" : undefined}>
          <CompoundSubtaskEditor
            subtasks={subtasks}
            onChange={setSubtasks}
            disabled={isSaving}
          />
        </div>

        <div className={type !== "iterative" ? "hidden" : undefined}>
          <IterativeRepetitionInput
            value={numberOfRepetition}
            onChange={setNumberOfRepetition}
            disabled={isSaving}
          />
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave() || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

