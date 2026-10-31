import { ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { CellDialog } from "./cell-dialog";

interface MarkCellCompleteDialogProps {
    cell: {
        id: string;
        resolutionText: string;
    };
    onUpdate?: (cellId: string, newState: 'pending' | 'completed') => void;
    open: boolean;
    setIsOpen: (open: boolean) => void;
}

export const MarkCellCompleteDialog = ({ cell, onUpdate, open, setIsOpen }: MarkCellCompleteDialogProps) => {
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const handleMarkComplete = async () => {
        if (!onUpdate) return;
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Spec 06: PENDING -> COMPLETED, no proof triggered automatically.
            onUpdate(cell.id, "completed");
            // Clean before close
            setIsSubmitting(false);
            setIsOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <CellDialog
            isOpen={open}
            setIsOpen={setIsOpen}
            title="Mark as Completed?"
            description={`You are about to mark "${cell.resolutionText}" as completed.`}
        >
            <DialogFooter>
                <Button onClick={handleMarkComplete} disabled={isSubmitting}>
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    Mark Complete
                </Button>
            </DialogFooter>
        </CellDialog>
    );
};