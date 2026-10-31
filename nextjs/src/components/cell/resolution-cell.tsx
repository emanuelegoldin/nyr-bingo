import { apiFetch } from "@/lib/api-client";
import { BingoCellWithThread } from "@/lib/db/types";
import { getSourceLabel } from "@/lib/shared/cell-source";
import { CellSourceType, CellState, ResolutionType, type Subtask } from "@/lib/shared/types";
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

/** Body of `GET /api/resolutions/{compound,iterative}?id=...`. */
interface ResolutionDetailResponse {
    resolution?: {
        id: string,
        title: string,
        description?: string | null,
        ownerUserId: string,
        // Compound resolutions carry `subtasks`, iterative ones the two counters.
        subtasks: Subtask[],
        numberOfRepetition: number,
        completedTimes: number,
    },
}

/**
 * Load the data shown by the detail dialog for a cell.
 * For base/team: uses the cell's existing data (no extra fetch needed).
 * For compound/iterative: fetches full data from the API.
 *
 * @param cell - The cell that was opened.
 * @returns The detail data, or null if the fetch failed (failures are silent).
 */
const fetchResolutionDetail = async (cell: BingoCellWithThread): Promise<ResolutionDetailData | null> => {
    const resType = cell.resolutionType;

    if (resType !== ResolutionType.COMPOUND && resType !== ResolutionType.ITERATIVE) {
        // Base or Team: no extra fetch needed, use cell data directly
        return {
            type: ResolutionType.BASE,
            id: cell.resolutionId ?? cell.id,
            title: cell.resolutionTitle || cell.resolutionText,
            description: cell.resolutionText !== cell.resolutionTitle ? cell.resolutionText : null,
        };
    }

    const endpoint = resType === ResolutionType.COMPOUND ? 'compound' : 'iterative';
    const result = await apiFetch<ResolutionDetailResponse>(`/api/resolutions/${endpoint}?id=${cell.resolutionId}`);
    if (!result.ok) return null;
    // With ?id= the route returns a single `resolution`
    const data = result.data.resolution;
    if (!data) return null;

    if (resType === ResolutionType.COMPOUND) {
        return {
            type: ResolutionType.COMPOUND,
            id: data.id,
            title: data.title,
            description: data.description,
            ownerUserId: data.ownerUserId,
            subtasks: data.subtasks,
        };
    }
    return {
        type: ResolutionType.ITERATIVE,
        id: data.id,
        title: data.title,
        description: data.description,
        ownerUserId: data.ownerUserId,
        numberOfRepetition: data.numberOfRepetition,
        completedTimes: data.completedTimes,
    };
};

interface ResolutionCellProps {
    cell: BingoCellWithThread,
    existingCells: BingoCellWithThread[],
    editMode: boolean,
    teamId: string,
    isOwner: boolean,
    currentUserId: string,
    onUpdate?: (cellId: string, cellState: "pending" | "completed") => void,
    onRefresh?: () => void,
}

export const ResolutionCell = ({
    cell,
    existingCells,
    editMode,
    teamId,
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

    /* ── Detail dialog action callbacks ──────────────────────────── */

    /** Owner wants to mark a base/team cell as complete — open the complete dialog. */
    const handleCompleteFromDetail = () => {
        setActiveDialog('complete');
    };

    /** Owner wants to undo a completed base/team cell. */
    const handleUndoFromDetail = () => {
        onUpdate?.(cell.id, CellState.PENDING);
    };

    /** Non-owner wants to request proof for a completed cell. */
    const handleRequestProofFromDetail = () => {
        setActiveDialog('request_proof');
    };

    /** Anyone wants to view the review thread. */
    const handleViewThreadFromDetail = () => {
        setActiveDialog('thread');
    };

    /** Open resolution history timeline dialog. */
    const handleViewHistoryFromDetail = () => {
        setActiveDialog('history');
    };

    const sourceLabel = getSourceLabel(cell, usernames);
    // Spec: 09-bingo-card-editing.md - In edit mode, any non-joker, non-team cell is selectable (including empty)
    const canEditContent = Boolean(editMode && isOwner && cell.sourceType !== CellSourceType.TEAM);
    const canInteract =
        (
            canEditContent ||
            (!editMode && !cell.isEmpty)  // Any non-empty cell can be clicked to open detail view
        );

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
                editMode={editMode}
                isOwner={isOwner}
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
                    teamId={teamId ? teamId : ""}
                    currentUserId={currentUserId ? currentUserId : ""}
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
                    canChangeProgress={
                        isOwner && (
                            cell.sourceType !== CellSourceType.TEAM
                            || (detailData.type !== ResolutionType.BASE && detailData.ownerUserId === currentUserId)
                        )
                    }
                    sourceLabel={sourceLabel}
                    onRefresh={onRefresh}
                    onComplete={handleCompleteFromDetail}
                    onUndo={handleUndoFromDetail}
                    onRequestProof={handleRequestProofFromDetail}
                    onViewThread={handleViewThreadFromDetail}
                    onViewHistory={handleViewHistoryFromDetail}
                />
            }
            {activeDialog === "history" && detailData &&
                <ResolutionHistoryDialog
                    resolutionId={detailData.id}
                    resolutionTitle={detailData.title}
                    isOpen={true}
                    setIsOpen={handleDialogOpenChange}
                />
            }
        </>
    );
}