import { CellSourceType, CellState, ProofStatus, ResolutionType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Check, Hourglass, ThumbsUp, X } from "lucide-react";
import { useState, useEffect } from "react";
import { MarkCellCompleteDialog } from "../dialogs/complete-dialog";
import { EditCellDialog } from "../dialogs/edit-cell";
import { RequestProofDialog } from "../dialogs/request-proof";
import { CellThreadDialog } from "../dialogs/thread-dialog";
import {
  ResolutionDetailDialog,
  type ResolutionDetailData,
  type CellContext,
} from "../dialogs/resolution-detail-dialog";
import { ResolutionHistoryDialog } from "../dialogs/resolution-history-dialog";
import { useTeamMembers } from "../team-members-context";
import { Badge } from "../ui/badge";
import { Cell } from "./cell";
import { BingoCell } from "./types";
import { EmptyCell } from "./empty";
import Link from "next/link";

interface ResolutionCellProps {
    cell: BingoCell,
    existingCells: BingoCell[],
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'complete' | 'request_proof' | 'thread' | 'edit_cell' | 'detail' | 'history' | null>(null);
    const [detailData, setDetailData] = useState<ResolutionDetailData | null>(null);
    const usernames = useTeamMembers();

    /**
     * Primary click handler — all non-edit clicks now route through the detail dialog.
     * The detail dialog contains action buttons (Mark Complete, Undo, Request Proof, View Thread).
     */
    const handleClick = () => {
        if (!canInteract) return;

        // Edit mode: open the edit cell dialog
        if (canEditContent) {
            setModalMode('edit_cell');
            setIsModalOpen(true);
            return;
        }

        // All other clicks: open the detail dialog
        openDetailDialog();
    };

    /**
     * Fetch resolution data and open the detail dialog.
     * For base/team: uses the cell's existing data (no extra fetch needed).
     * For compound/iterative: fetches full data from the API.
     */
    const openDetailDialog = async () => {
        const resType = cell.resolutionType;

        if (resType === ResolutionType.COMPOUND) {
            try {
                const res = await fetch(`/api/resolutions/compound?id=${cell.resolutionId}`);
                if (!res.ok) return;
                const { resolutions, resolution } = await res.json();
                const data = resolution ?? (resolutions?.find?.((r: { id: string }) => r.id === cell.resolutionId));
                if (data) {
                    setDetailData({
                        type: ResolutionType.COMPOUND,
                        id: data.id,
                        title: data.title,
                        description: data.description,
                        subtasks: data.subtasks,
                    });
                    setModalMode('detail');
                    setIsModalOpen(true);
                }
            } catch { /* ignore */ }
        } else if (resType === ResolutionType.ITERATIVE) {
            try {
                const res = await fetch(`/api/resolutions/iterative?id=${cell.resolutionId}`);
                if (!res.ok) return;
                const { resolutions, resolution } = await res.json();
                const data = resolution ?? (resolutions?.find?.((r: { id: string }) => r.id === cell.resolutionId));
                if (data) {
                    setDetailData({
                        type: ResolutionType.ITERATIVE,
                        id: data.id,
                        title: data.title,
                        description: data.description,
                        numberOfRepetition: data.numberOfRepetition,
                        completedTimes: data.completedTimes,
                    });
                    setModalMode('detail');
                    setIsModalOpen(true);
                }
            } catch { /* ignore */ }
        } else {
            // Base or Team: no extra fetch needed, use cell data directly
            setDetailData({
                type: ResolutionType.BASE,
                id: cell.resolutionId ?? cell.id,
                title: cell.resolutionTitle || cell.resolutionText,
                description: cell.resolutionText !== cell.resolutionTitle ? cell.resolutionText : null,
            });
            setModalMode('detail');
            setIsModalOpen(true);
        }
    };

    /* ── Detail dialog action callbacks ──────────────────────────── */

    /** Owner wants to mark a base/team cell as complete — open the complete dialog. */
    const handleCompleteFromDetail = () => {
        setModalMode('complete');
        setIsModalOpen(true);
    };

    /** Owner wants to undo a completed base/team cell. */
    const handleUndoFromDetail = () => {
        onUpdate?.(cell.id, CellState.PENDING);
    };

    /** Non-owner wants to request proof for a completed cell. */
    const handleRequestProofFromDetail = () => {
        setModalMode('request_proof');
        setIsModalOpen(true);
    };

    /** Anyone wants to view the review thread. */
    const handleViewThreadFromDetail = () => {
        setModalMode('thread');
        setIsModalOpen(true);
    };

    /** Open resolution history timeline dialog. */
    const handleViewHistoryFromDetail = () => {
        setModalMode('history');
        setIsModalOpen(true);
    };

    useEffect(() => {
        if (!isModalOpen) {
            setModalMode(null);
        }
    }, [isModalOpen]);

    const stateConfig = {
        pending: { icon: null, color: "bg-card hover:bg-secondary/50", text: "text-card-foreground" },
        completed: { icon: <Check className="h-4 w-4 text-green-500" />, color: "bg-green-100 dark:bg-green-900/50", text: "text-green-800 dark:text-green-300" },
        pending_review: { icon: <Hourglass className="h-4 w-4 text-amber-500" />, color: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-800 dark:text-amber-300" },
        accomplished: { icon: <ThumbsUp className="h-4 w-4 text-green-500" />, color: "bg-green-100 dark:bg-green-900/50", text: "text-green-800 dark:text-green-300 line-through" },
        declined: { icon: <X className="h-4 w-4 text-red-500" />, color: "bg-red-100 dark:bg-red-900/50", text: "text-red-800 dark:text-red-300" },
    };
    // Determine visual state based on cell state and proof status
    let visualState: keyof typeof stateConfig = cell.state;
    if (cell.proof) {
        if (cell.proof.status === ProofStatus.PENDING) visualState = 'pending_review';
        else if (cell.proof.status === ProofStatus.DECLINED) visualState = 'declined';
        else if (cell.proof.status === ProofStatus.APPROVED) visualState = 'accomplished';
    }

    const config = stateConfig[visualState] || stateConfig.pending;
    // Resolution title for cell display (truncated with CSS ellipsis)
    const displayTitle = cell.resolutionTitle || cell.resolutionText;
    // Spec: 09-bingo-card-editing.md - In edit mode, any non-joker, non-team cell is selectable (including empty)
    const canEditContent = Boolean(editMode && isOwner && cell.sourceType !== CellSourceType.TEAM);
    // Compound/iterative types disable manual complete — state is automatic
    const isAutomatic = cell.resolutionType === ResolutionType.COMPOUND || cell.resolutionType === ResolutionType.ITERATIVE;
    const canInteract =
        cell.state !== CellState.ACCOMPLISHED &&    // Accomplished cells have no interactions
        (
            canEditContent ||
            (!editMode && !cell.isEmpty)  // Any non-empty cell can be clicked to open detail view
        );

    /** Build cell context for the detail dialog */
    const cellContext: CellContext = {
        cellId: cell.id,
        state: cell.state,
        proofStatus: cell.proof?.status ?? null,
        reviewThreadId: cell.reviewThreadId ?? null,
    };

    return (
        <>
            {cell.isEmpty ?
                <EmptyCell 
                    editMode={editMode}
                    isOwner={isOwner} 
                    onClick={handleClick}/>
            :
                <Cell
                    cellClassName={cn(
                        "relative flex flex-col items-center justify-center aspect-square p-2 rounded-lg border shadow-sm text-center transition-all duration-300",
                        config.color,
                        canInteract ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-default"
                    )}
                    isDisabled={!canInteract}
                    onClick={handleClick}>

                    <p className={cn("text-xs md:text-sm font-medium truncate max-w-full", config.text)}>
                        {displayTitle}
                    </p>
                    <div className="absolute top-1 right-1">
                        {visualState !== 'pending' && config.icon}
                    </div>
                    <Badge variant="outline" className="absolute bottom-1 right-1 text-xs hidden sm:inline-flex">
                        {cell.sourceType === CellSourceType.TEAM && "Team Goal"}
                        {cell.sourceType === CellSourceType.MEMBER_PROVIDED && (
                          cell.sourceUserId ? (
                            <Link
                              href={`/profile/${cell.sourceUserId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {usernames[cell.sourceUserId] ?? "Team member"}
                            </Link>
                          ) : "Team member"
                        )}
                        {cell.sourceType === CellSourceType.PERSONAL && "Personal"}
                    </Badge>
                </Cell>
            }
            {modalMode === "complete" &&
                <MarkCellCompleteDialog
                    cell={{
                        id: cell.id,
                        resolutionText: cell.resolutionText
                    }}
                    open={isModalOpen}
                    setIsOpen={setIsModalOpen}
                    onUpdate={onUpdate} />
            }
            {modalMode === "request_proof" &&
                <RequestProofDialog
                    cell={{
                        id: cell.id,
                        resolutionText: cell.resolutionText
                    }}
                    isOpen={isModalOpen}
                    setIsOpen={setIsModalOpen}
                    onRefresh={onRefresh} />
            }
            {modalMode === "edit_cell" && isOwner &&
                <EditCellDialog
                    cellId={cell.id}
                    existingCells={existingCells}
                    teamId={teamId ? teamId : ""}
                    currentUserId={currentUserId ? currentUserId : ""}
                    isOpen={isModalOpen}
                    setIsOpen={setIsModalOpen}
                    onRefresh={onRefresh} />
            }
            {modalMode === "thread" &&
                <CellThreadDialog
                    cell={{
                        id: cell.id,
                        resolutionText: cell.resolutionText,
                        reviewThreadId: cell.reviewThreadId ? cell.reviewThreadId : ""
                    }}
                    isOwner={isOwner}
                    isOpen={isModalOpen}
                    setIsOpen={setIsModalOpen}
                    onRefresh={onRefresh} />
            }
            {modalMode === "detail" && detailData &&
                <ResolutionDetailDialog
                    data={detailData}
                    cell={cellContext}
                    isOpen={isModalOpen}
                    setIsOpen={setIsModalOpen}
                    isOwner={isOwner}
                    sourceLabel={
                      cell.sourceType === CellSourceType.TEAM
                        ? "Team Goal"
                        : cell.sourceType === CellSourceType.MEMBER_PROVIDED
                          ? (cell.sourceUserId ? (usernames[cell.sourceUserId] ?? "Team member") : "Team member")
                          : "Personal"
                    }
                    onRefresh={onRefresh}
                    onComplete={handleCompleteFromDetail}
                    onUndo={handleUndoFromDetail}
                    onRequestProof={handleRequestProofFromDetail}
                    onViewThread={handleViewThreadFromDetail}
                    onViewHistory={handleViewHistoryFromDetail}
                />
            }
            {modalMode === "history" && detailData &&
                <ResolutionHistoryDialog
                    resolutionId={detailData.id}
                    resolutionTitle={detailData.title}
                    isOpen={isModalOpen}
                    setIsOpen={setIsModalOpen}
                />
            }
        </>
    );
}