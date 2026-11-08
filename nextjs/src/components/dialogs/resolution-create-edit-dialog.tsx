/**
 * Resolution Create/Edit Dialog
 * A unified dialog for creating and editing the personal, team and member-provided resolutions of a game.
 * Spec Reference: 03-personal-resolutions.md - Create Dialog
 *
 * Features:
 * - Title input + type dropdown in the header
 * - Description textarea shared across all types
 * - Type-specific sections kept mounted but hidden (preserves state on type switch)
 * - Subtask list management for compound resolutions
 * - Number of repetitions input for iterative resolutions
 * - Reusable for both create and edit flows
 * - Opens with an empty form to create, or the resolution to edit, every time (no state left from the last use)
 */

"use client";

import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { initialResolutionFormState } from "@/lib/shared/resolution-form";
import type { ResolutionFormData, ResolutionTypeValue, Subtask } from "@/lib/shared/types";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
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
  /** The game the resolution belongs to; required to create one. */
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
  t: ReturnType<typeof useTranslations<"ResolutionForm">>,
  scope: "personal" | "team" | "member_provided",
  isEdit: boolean,
  recipientName?: string,
): { title: string; description: string } => {
  if (scope === "team") {
    return {
      title: isEdit ? t("teamTitleEdit") : t("teamTitleNew"),
      description: t("teamDescription"),
    };
  }
  if (scope === "member_provided") {
    return {
      title: isEdit
        ? t("memberTitleEdit", { name: recipientName ?? t("defaultMember") })
        : t("memberTitleNew", { name: recipientName ?? t("defaultMember") }),
      description: t("memberDescription", { name: recipientName ?? t("defaultMemberLower") }),
    };
  }
  return {
    title: isEdit ? t("titleEdit") : t("titleNew"),
    description: isEdit ? t("descriptionEdit") : t("descriptionNew"),
  };
};

/* ─── Component ──────────────────────────────────────────────────── */

/**
 * Dialog for creating or editing a resolution of a game: personal, the team goal or for a teammate.
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
  const tl = useTranslations("Labels");
  const t = useTranslations("ResolutionForm");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  const { toast } = useToast();
  const isEdit = Boolean(initialData?.id);

  const initialState = initialResolutionFormState(initialData);

  // ── Common fields ────────────────────────────────────────────
  const [type, setType] = useState<ResolutionTypeValue>(initialState.type);
  const [title, setTitle] = useState(initialState.title);
  const [text, setText] = useState(initialState.text);

  // ── Compound fields ──────────────────────────────────────────
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialState.subtasks);

  // ── Iterative fields ─────────────────────────────────────────
  const [numberOfRepetition, setNumberOfRepetition] = useState<number>(initialState.numberOfRepetition);

  const [isSaving, setIsSaving] = useState(false);

  // The dialog stays mounted between uses, so every opening starts again from the initial state:
  // an empty Common form to create, or the resolution to edit (spec 03 - Create Dialog).
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const reset = initialResolutionFormState(initialData);
      setType(reset.type);
      setTitle(reset.title);
      setText(reset.text);
      setSubtasks(reset.subtasks);
      setNumberOfRepetition(reset.numberOfRepetition);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialData]);

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

      body.scope = scope;
      if (gameId) body.gameId = gameId;
      if (toUserId) body.toUserId = toUserId;

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
        toastApiError(result, t("saveError"));
        return;
      }

      onSaved?.();

      setIsOpen(false);
      toast({
        title: tc("success"),
        description: isEdit ? t("updated") : t("created"),
      });
    } catch {
      toast({
        title: tc("error"),
        description: t("saveErrorGeneric"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, title, text, subtasks, numberOfRepetition, isSaving, initialData, isEdit, scope, gameId, toUserId]);

  const copy = dialogCopy(t, scope, isEdit, recipientName);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
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
            placeholder={t("titlePlaceholder")}
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
              <SelectItem value="base">{tl("resolutionType.base")}</SelectItem>
              <SelectItem value="compound">{tl("resolutionType.compound")}</SelectItem>
              <SelectItem value="iterative">{tl("resolutionType.iterative")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Description ───────────────────────────────────────── */}
        <Textarea
          placeholder={t("textPlaceholder")}
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
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave() || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isEdit ? tc("save") : tc("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

