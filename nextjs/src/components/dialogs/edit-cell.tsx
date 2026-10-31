import { useEditCellOptions, type EditOption } from "@/hooks/use-edit-cell-options";
import { useToast } from "@/hooks/use-toast";
import type { BingoCellWithThread } from "@/lib/db/types";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "../ui/input";
import { CellDialog } from "./cell-dialog";
import { EditOptionRow } from "./edit-option-row";

interface EditCellDialogProps {
  cellId: string,
  existingCells: BingoCellWithThread[],
  teamId: string,
  currentUserId: string,
  isOpen: boolean,
  setIsOpen: (isOpen: boolean) => void
  onRefresh?: () => void
}

export const EditCellDialog = ({
  cellId,
  existingCells,
  teamId,
  currentUserId,
  isOpen,
  setIsOpen,
  onRefresh
}: EditCellDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFilter, setEditFilter] = useState('');
  const {
    editOptions,
    usernames,
    isLoading: isEditOptionsLoading,
    reset: resetEditOptions
  } = useEditCellOptions({ cellId, existingCells, teamId, currentUserId, isOpen });
  const { toast } = useToast();

  const handleSelectReplacement = async (opt: EditOption) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/cells/${cellId}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionId: opt.resolutionId,
          resolutionType: opt.resolutionType,
          sourceType: opt.sourceType,
          sourceUserId: opt.sourceUserId,
          isEmpty: opt.isEmpty,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to update cell',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Cell updated',
        description: 'The bingo card has been updated.',
      });
      // Clean before close
      resetEditOptions();
      setIsSubmitting(false);
      setEditFilter('');
      setIsOpen(false);
      // onRefresh is wrapped by BingoCard to broadcast a
      // card-refresh after the async reload completes.
      onRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CellDialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title="Edit Cell"
      description="Choose a replacement resolution for this cell.">
      <div className="space-y-3 py-4">
        <Input
          placeholder="Filter resolutions…"
          value={editFilter}
          onChange={(e) => setEditFilter(e.target.value)}
          disabled={isSubmitting || isEditOptionsLoading}
        />

        {isEditOptionsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading options…
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-md border p-2 space-y-2">
            {editOptions
              .filter((opt) => {
                const q = editFilter.trim().toLowerCase();
                if (!q) return true;
                return opt.label.toLowerCase().includes(q);
              })
              .map((opt) => (
                <EditOptionRow
                  key={opt.key}
                  option={opt}
                  usernames={usernames}
                  isSubmitting={isSubmitting}
                  onSelect={handleSelectReplacement} />
              ))}

            {editOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">No options available.</p>
            )}
          </div>
        )}
      </div>
    </CellDialog>
  )
}