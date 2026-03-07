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

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Subtask } from "@/lib/shared/types";

/* ─── Types ──────────────────────────────────────────────────────── */

type ResolutionTypeValue = "base" | "compound" | "iterative";

/** Shape of a resolution passed in for editing (matches the unified API response). */
export interface ResolutionFormData {
  id?: string;
  type: ResolutionTypeValue;
  title: string;
  text: string;
  subtasks?: Subtask[];
  numberOfRepetition?: number;
}

interface ResolutionCreateEditDialogProps {
  /** If provided, the dialog is in edit mode with pre-filled data. */
  initialData?: ResolutionFormData;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** Called after a successful save with the saved resolution data. */
  onSaved?: (resolution: ResolutionFormData & { id: string }) => void;
}

/* ─── Human-readable labels ──────────────────────────────────────── */

const TYPE_LABELS: Record<ResolutionTypeValue, string> = {
  base: "Common",
  compound: "Complex",
  iterative: "Iterative",
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
  const originalType = initialData?.type;

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

      if (isEdit && initialData?.id) {
        body.id = initialData.id;
        if (originalType && originalType !== type) {
          body.previousType = originalType;
        }
      }

      if (type === "compound") {
        body.subtasks = subtasks;
      }
      if (type === "iterative") {
        body.numberOfRepetition = numberOfRepetition;
      }

      const res = await fetch("/api/resolutions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to save resolution",
          variant: "destructive",
        });
        return;
      }

      onSaved?.({
        id: data.resolution.id,
        type: data.resolution.type,
        title: data.resolution.title,
        text: data.resolution.text ?? "",
        subtasks: data.resolution.subtasks,
        numberOfRepetition: data.resolution.numberOfRepetition,
      });

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
  }, [type, title, text, subtasks, numberOfRepetition, isSaving, initialData, isEdit, originalType]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {isEdit ? "Edit Resolution" : "New Resolution"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the resolution details below."
              : "Create a new personal resolution."}
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
              <SelectItem value="base">{TYPE_LABELS.base}</SelectItem>
              <SelectItem value="compound">{TYPE_LABELS.compound}</SelectItem>
              <SelectItem value="iterative">{TYPE_LABELS.iterative}</SelectItem>
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

/* ─── Compound Subtask Editor ────────────────────────────────────── */

interface CompoundSubtaskEditorProps {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
  disabled?: boolean;
}

/**
 * Manages a list of subtasks: add, edit, delete.
 * Similar to the original resolution list management style.
 */
const CompoundSubtaskEditor = ({ subtasks, onChange, disabled }: CompoundSubtaskEditorProps) => {
  const [newTitle, setNewTitle] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onChange([...subtasks, { title: trimmed, description: "", completed: false }]);
    setNewTitle("");
  };

  const handleDelete = (idx: number) => {
    onChange(subtasks.filter((_, i) => i !== idx));
  };

  const handleStartEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditingText(subtasks[idx].title);
  };

  const handleSaveEdit = (idx: number) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    const updated = [...subtasks];
    updated[idx] = { ...updated[idx], title: trimmed };
    onChange(updated);
    setEditingIdx(null);
    setEditingText("");
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditingText("");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Subtasks</p>

      {/* Add subtask */}
      <div className="flex gap-2">
        <Input
          placeholder="New subtask..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleAdd}
          disabled={disabled || !newTitle.trim()}
          aria-label="Add subtask"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Subtask list */}
      {subtasks.length > 0 && (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {subtasks.map((st, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between p-2 rounded-md bg-secondary/50 text-sm"
            >
              {editingIdx === idx ? (
                <Input
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="h-7 text-sm flex-1 mr-1"
                  disabled={disabled}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(idx);
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  autoFocus
                />
              ) : (
                <span className="truncate flex-1">{st.title}</span>
              )}

              <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                {editingIdx === idx ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-green-600"
                      onClick={() => handleSaveEdit(idx)}
                      disabled={disabled || !editingText.trim()}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-600"
                      onClick={handleCancelEdit}
                      disabled={disabled}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleStartEdit(idx)}
                      disabled={disabled}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(idx)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {subtasks.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No subtasks yet. Add at least one subtask.
        </p>
      )}
    </div>
  );
};

/* ─── Iterative Repetition Input ─────────────────────────────────── */

interface IterativeRepetitionInputProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

/**
 * Number input for the target repetition count.
 * Minimum value: 2.
 */
const IterativeRepetitionInput = ({ value, onChange, disabled }: IterativeRepetitionInputProps) => {
  return (
    <div className="space-y-2">
      <label htmlFor="num-repetitions" className="text-sm font-medium">
        Number of Repetitions
      </label>
      <Input
        id="num-repetitions"
        type="number"
        min={2}
        step={1}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(v);
        }}
        disabled={disabled}
        className="w-32"
      />
      <p className="text-xs text-muted-foreground">
        Must be at least 2. The resolution will be completed when you reach this count.
      </p>
    </div>
  );
};
