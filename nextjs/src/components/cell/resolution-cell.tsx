import { CellSourceType, CellState, ProofStatus, ResolutionType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Check, Hourglass, ThumbsUp, X } from "lucide-react";
import { useState, useEffect } from "react";
import { MarkCellCompleteDialog } from "../dialogs/complete-dialog";
import { EditCellDialog } from "../dialogs/edit-cell";
import { RequestProofDialog } from "../dialogs/request-proof";
import { CellThreadDialog } from "../dialogs/thread-dialog";
import { ResolutionDetailDialog } from "../dialogs/resolution-detail-dialog";
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
    const [modalMode, setModalMode] = useState<'complete' | 'request_proof' | 'thread' | 'edit_cell' | 'detail' | null>(null);
    const [detailData, setDetailData] = useState<Parameters<typeof ResolutionDetailDialog>[0]['data'] | null>(null);
    const usernames = useTeamMembers();

    const handleClick = () => {
        if (!canInteract) return;
        if (canEditContent) {
            setModalMode('edit_cell');
            setIsModalOpen(true);
            return;
        }  
        if (isOwner) {
            // Compound/iterative resolutions open the detail dialog for progress tracking
            const isAutomatic = cell.resolutionType === ResolutionType.COMPOUND || cell.resolutionType === ResolutionType.ITERATIVE;
            if (isAutomatic && cell.state !== CellState.PENDING_REVIEW) {
                openDetailDialog();
                return;
            }
            if (cell.state === CellState.PENDING && !isAutomatic) {
                setModalMode('complete');
                setIsModalOpen(true);
                return;
            }
            if (cell.state === CellState.PENDING_REVIEW) {
                setModalMode('thread');
                setIsModalOpen(true);
                return;
            }
            // isOwner && completed --> set pending (only for base/team types)
            if (cell.state === CellState.COMPLETED && !isAutomatic){
                onUpdate?.(cell.id, CellState.PENDING);
                return;
            }
        }
        // Viewing someone else's card — allow viewing detail for compound/iterative
        const isAutomatic = cell.resolutionType === ResolutionType.COMPOUND || cell.resolutionType === ResolutionType.ITERATIVE;
        if (isAutomatic) {
            openDetailDialog();
            return;
        }
        if (cell.state === CellState.COMPLETED) {
            setModalMode('request_proof');
            setIsModalOpen(true);
            return;
        }
        if (cell.state === CellState.PENDING_REVIEW) {
            setModalMode('thread');
            setIsModalOpen(true);
        }
    };

    /**
     * Fetch compound or iterative resolution data and open the detail dialog.
     */
    const openDetailDialog = async () => {
        const resType = cell.resolutionType;
        if (resType === ResolutionType.COMPOUND) {
            try {
                const res = await fetch(`/api/resolutions/compound?id=${cell.resolutionId}`);
                if (!res.ok) return;
                const { resolutions, resolution } = await res.json();
                // API may return list or single — handle both
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
        }
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
            (!editMode && !cell.isEmpty && (
                isOwner
                  ? true  // Owner can always interact (detail dialog for automatic, complete/undo for manual)
                  : (isAutomatic || cell.state === CellState.COMPLETED || cell.state === CellState.PENDING_REVIEW)
            ))
        );
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
                    <Badge variant="outline" className="absolute bottom-1 right-1 text-xs">
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
                    isOpen={isModalOpen}
                    setIsOpen={setIsModalOpen}
                    isOwner={isOwner}
                    onRefresh={onRefresh} />
            }
        </>
    );
}