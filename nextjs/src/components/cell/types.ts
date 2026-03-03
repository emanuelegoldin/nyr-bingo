import { CellSourceType, CellState, ProofStatus, ResolutionType } from "@/lib/shared/types";

export interface BingoCell {
    id: string;
    cardId: string;
    position: number;
    resolutionId: string | null;
    resolutionType: ResolutionType;
    resolutionText: string;
    resolutionTitle: string;
    isJoker: boolean;
    isEmpty: boolean;
    sourceType: CellSourceType;
    sourceUserId: string | null;
    state: CellState;
    reviewThreadId?: string | null;
    proof: {
        id: string;
        status: ProofStatus;
    } | null;
}