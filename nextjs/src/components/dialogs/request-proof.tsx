import { useToast } from "@/hooks/use-toast";
import { apiFetch, toastApiError } from "@/lib/api-client";
import { useState } from "react";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { CellDialog } from "./cell-dialog";

interface RequestProofDialogProps {
    cell: {
        id: string;
        resolutionText: string;
    };
    isOpen: boolean,
    setIsOpen: (isOpen: boolean) => void
    onRefresh?: () => void;
}

export const RequestProofDialog = ({
    cell,
    isOpen,
    setIsOpen,
    onRefresh
}: RequestProofDialogProps) => {
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const { toast } = useToast();

    const handleRequestProof = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const result = await apiFetch<unknown>(`/api/cells/${cell.id}/request-proof`, { method: 'POST' });

            if (!result.ok) {
                toastApiError(result, 'Failed to request proof');
                return;
            }

            toast({
                title: 'Proof requested',
                description: 'A review thread has been opened for this resolution.',
            });

            // Parent pages keep cards in local state; request-proof changes cell state server-side.
            // Best-effort refresh so the card reflects the new state/thread.
            onRefresh?.();
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to request proof',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
            setIsOpen(false);
        }
    };
    return (
        <CellDialog
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            title="Request Proof?"
            description={`Request proof for "${cell.resolutionText}". This will open a review thread and move the resolution into review.`}
        >
            <DialogFooter>
                <Button onClick={handleRequestProof} disabled={isSubmitting}>Request Proof</Button>
            </DialogFooter>
        </CellDialog>
    )
}