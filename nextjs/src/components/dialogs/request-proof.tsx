import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { useTranslations } from "next-intl";
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
    const t = useTranslations("Threads.requestProof");
    const tc = useTranslations("Common");
    const toastApiError = useApiErrorToast();

    const handleRequestProof = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const result = await apiFetch<unknown>(`/api/cells/${cell.id}/request-proof`, { method: 'POST' });

            if (!result.ok) {
                toastApiError(result, t("failed"));
                return;
            }

            toast({
                title: t("successTitle"),
                description: t("successDescription"),
            });

            // Parent pages keep cards in local state; request-proof changes cell state server-side.
            // Best-effort refresh so the card reflects the new state/thread.
            onRefresh?.();
        } catch {
            toast({
                title: tc("error"),
                description: t("failed"),
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
            title={t("title")}
            description={t("description", { resolutionText: cell.resolutionText })}
        >
            <DialogFooter>
                <Button onClick={handleRequestProof} disabled={isSubmitting}>{t("submit")}</Button>
            </DialogFooter>
        </CellDialog>
    )
}