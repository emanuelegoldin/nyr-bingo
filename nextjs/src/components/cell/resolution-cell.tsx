import { apiFetch } from "@/lib/api-client";
import { BingoCellDetail, BingoCellWithThread } from "@/lib/db/types";
import { getSourceLabel } from "@/lib/shared/cell-source";
import { CellSourceType, CellState, ResolutionType } from "@/lib/shared/types";
import { useState } from "react";
import { MarkCellCompleteDialog } from "../dialogs/complete-dialog";
import { EditCellDialog } from "../dialogs/edit-cell";
import { RequestProofDialog } from "../dialogs/request-proof";
import {
    ResolutionDetailDialog,
    type CellContext,
    type ResolutionDetailData,
} from "../dialogs/resolution-detail-dialog";
import { ResolutionHistoryDialog } from "../dialogs/resolution-history-dialog";
import { CellThreadDialog } from "../dialogs/thread-dialog";
import { useTeamMembers } from "../team-members-context";
import { CellFace } from "./cell-face";

/** The dialog currently opened from a cell, or null when none is open. */
type ActiveDialog = 'complete' | 'request_proof' | 'thread' | 'edit_cell' | 'detail' | 'history' | null;

/**
 * Load the data shown by the detail dialog for a cell.
 * The cell holds its own copy of the resolution and its progress.
 * Spec: 06-bingo-gameplay.md - Cell Detail Dialog
 *
 * @param cell - The cell that was opened.
 * @returns The detail data, or null if the fetch failed (failures are silent).
 */
const fetchResolutionDetail = async (cell: BingoCellWithThread): Promise<ResolutionDetailData | null> => {
    const result = await apiFetch<{ cell: BingoCellDetail }>(`/api/cells/${cell.id}`);
    if (!result.ok) return null;
    const detail = result.data.cell;
    const title = detail.resolutionTitle || detail.resolutionText;
    // A base resolution without text stores its title as description; show it only once
    const description = detail.description !== title ? detail.description : null;

    if (detail.resolutionType === ResolutionType.COMPOUND) {
        return {
            type: ResolutionType.COMPOUND,
            title,
            description,
            subtasks: detail.subtasks ?? [],
        };
    }
    if (detail.resolutionType === ResolutionType.ITERATIVE) {
        return {
            type: ResolutionType.ITERATIVE,
            title,
            description,
            numberOfRepetition: detail.numberOfRepetition ?? 0,
            completedTimes: detail.completedTimes,
        };
    }
    return { type: ResolutionType.BASE, title, description };
};

interface ResolutionCellProps {
    cell: BingoCellWithThread,
    existingCells: BingoCellWithThread[],
    editMode: boolean,
    gameId: string,
    isOwner: boolean,
    currentUserId: string,
    onUpdate?: (cellId: string, cellState: "pending" | "completed" | "failed") => void,
    onRefresh?: () => void,
}

export const ResolutionCell = ({
    cell,
    existingCells,
    editMode,
    gameId,
    isOwner,
    currentUserId,
    onUpdate,
    onRefresh
}: ResolutionCellProps) => {
    const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
    const [detailData, setDetailData] = useState<ResolutionDetailData | null>(null);
    const usernames = useTeamMembers();

    /** Dialogs report close requests through this; opening is done via `setActiveDialog`. */
    const handleDialogOpenChange = (open: boolean) => {
        if (!open) setActiveDialog(null);
    };

    // Spec: 09-bingo-card-editing.md - In edit mode, any non-joker, non-team cell not under review is selectable (including empty)
    const canEditContent = Boolean(
        editMode && isOwner && cell.sourceType !== CellSourceType.TEAM && cell.state !== CellState.PENDING_REVIEW
    );
    const canInteract =
        (
            canEditContent ||
            (!editMode && !cell.isEmpty)  // Any non-empty cell can be clicked to open detail view
        );

    /**
     * Primary click handler — all non-edit clicks now route through the detail dialog.
     * The detail dialog contains action buttons (Mark Complete, Undo, Request Proof, View Thread).
     */
    const handleClick = () => {
        if (!canInteract) return;

        // Edit mode: open the edit cell dialog
        if (canEditContent) {
            setActiveDialog('edit_cell');
            return;
        }

        // All other clicks: open the detail dialog
        openDetailDialog();
    };

    /** Load the resolution data and open the detail dialog. */
    const openDetailDialog = async () => {
        const data = await fetchResolutionDetail(cell);
        if (!data) return;
        setDetailData(data);
        setActiveDialog('detail');
    };

    const sourceLabel = getSourceLabel(cell, usernames);
    /** Build cell context for the detail dialog */
    const cellContext: CellContext = {
        cellId: cell.id,
        state: cell.state,
        reviewThreadId: cell.reviewThreadId ?? null,
    };

    return (
        <>
            <CellFace
                cell={cell}
                canInteract={canInteract}
                sourceLabel={sourceLabel}
                onClick={handleClick} />
            {activeDialog === "complete" &&
                <MarkCellCompleteDialog
                    cell={{
                        id: cell.id,
                        resolutionText: cell.resolutionText
                    }}
                    open={true}
                    setIsOpen={handleDialogOpenChange}
                    onUpdate={onUpdate} />
            }
            {activeDialog === "request_proof" &&
                <RequestProofDialog
                    cell={{
                        id: cell.id,
                        resolutionText: cell.resolutionText
                    }}
                    isOpen={true}
                    setIsOpen={handleDialogOpenChange}
                    onRefresh={onRefresh} />
            }
            {activeDialog === "edit_cell" && isOwner &&
                <EditCellDialog
                    cellId={cell.id}
                    existingCells={existingCells}
                    gameId={gameId}
                    currentUserId={currentUserId}
                    isOpen={true}
                    setIsOpen={handleDialogOpenChange}
                    onRefresh={onRefresh} />
            }
            {activeDialog === "thread" &&
                <CellThreadDialog
                    cell={{
                        id: cell.id,
                        resolutionText: cell.resolutionText,
                        reviewThreadId: cell.reviewThreadId ? cell.reviewThreadId : ""
                    }}
                    isOwner={isOwner}
                    currentUserId={currentUserId}
                    isOpen={true}
                    setIsOpen={handleDialogOpenChange}
                    onRefresh={onRefresh} />
            }
            {activeDialog === "detail" && detailData &&
                <ResolutionDetailDialog
                    data={detailData}
                    cell={cellContext}
                    isOpen={true}
                    setIsOpen={handleDialogOpenChange}
                    isOwner={isOwner}
                    sourceLabel={sourceLabel}
                    onRefresh={onRefresh}
                    onOpenDialog={setActiveDialog}
                    onSetState={(state) => onUpdate?.(cell.id, state)}
                />
            }
            {activeDialog === "history" && detailData &&
                <ResolutionHistoryDialog
                    cellId={cell.id}
                    resolutionTitle={detailData.title}
                    isOpen={true}
                    setIsOpen={handleDialogOpenChange}
                />
            }
        </>
    );
}