"use client";

import type { Subtask } from "@/lib/shared/types";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

interface CompoundSubtaskEditorProps {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
  disabled?: boolean;
}

/**
 * Manages a list of subtasks: add, edit, delete.
 * Similar to the original resolution list management style.
 */
export const CompoundSubtaskEditor = ({ subtasks, onChange, disabled }: CompoundSubtaskEditorProps) => {
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
