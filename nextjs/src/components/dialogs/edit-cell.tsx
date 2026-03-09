import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { CellDialog } from "./cell-dialog"
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CellState, ProofStatus, CellSourceType, ResolutionType } from "@/lib/shared/types";

interface BingoCell {
      id: string;
      cardId: string;
      position: number;
      resolutionId?: string | null;
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

interface EditCellDialogProps {
    cellId: string,
    existingCells: BingoCell[],
    teamId: string,
    currentUserId: string,
    isOpen: boolean,
    setIsOpen: (isOpen: boolean) => void
    onRefresh?: () => void
}

type EditOption = {
  key: string;
  label: string;
  resolutionText: string;
  resolutionId: string | null;
  resolutionType: ResolutionType;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  isEmpty: boolean;
};

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
    const [isEditOptionsLoading, setIsEditOptionsLoading] = useState(false);
    const [editFilter, setEditFilter] = useState('');
    const [editOptions, setEditOptions] = useState<EditOption[]>([]);
    const [usernames, setUsernames] = useState<Record<string, string>>({});
    const { toast } = useToast();

    useEffect(() => {
        const loadEditOptions = async () => {    
          const occupiedKeys = new Set<string>(
            (Array.isArray(existingCells) ? existingCells : [])
              .filter((c: BingoCell) => !c.isJoker && !c.isEmpty)
              .map((c: BingoCell) => {
                if (c.sourceType === CellSourceType.PERSONAL && c.resolutionId) return `personal:${c.resolutionId}`;
                if (c.sourceType === CellSourceType.MEMBER_PROVIDED && c.resolutionId) return `member_provided:${c.resolutionId}`;
                // "team" and "empty" cells do not have a stable resolution id reference.
                return null;
              })
              .filter((v: string | null): v is string => typeof v === 'string' && v.length > 0)
          );
    
          setIsEditOptionsLoading(true);
          try {
            // Fetch ALL resolution types (base + compound + iterative) via the unified endpoint
            const personalReq = fetch('/api/resolutions/all');
            const teamReq = teamId && currentUserId
              ? fetch(`/api/teams/${teamId}/resolutions?toUserId=${encodeURIComponent(currentUserId)}`)
              : null;
    
            const [personalRes, teamRes] = await Promise.all([
              personalReq,
              teamReq ?? Promise.resolve(null as unknown as Response | null),
            ]);
    
            const personalData = await personalRes.json().catch(() => ({}));
            if (!personalRes.ok) {
              toast({
                title: 'Error',
                description: personalData?.error || 'Failed to load personal resolutions',
                variant: 'destructive',
              });
              return;
            }
    
            const personalOptions: EditOption[] = (personalData?.resolutions || [])
              .map((r: any) => ({
              key: `personal:${r.id}`,
              label: r.title || r.text || r.title,
              resolutionText: r.text || r.title,
              resolutionId: typeof r.id === 'string' ? r.id : null,
              resolutionType: (r.type as ResolutionType) ?? ResolutionType.BASE,
              sourceType: CellSourceType.PERSONAL,
              sourceUserId: currentUserId ?? null,
              isEmpty: false,
            }))
              // Prevent duplicates: do not allow selecting texts already used in other non-empty cells
              // Spec: 05-bingo-card-generation.md - No duplicates in a card
              .filter((opt: EditOption) => !occupiedKeys.has(opt.key));
    
            let teamOptions: EditOption[] = [];
            if (teamRes) {
              const teamData = await teamRes.json().catch(() => ({}));
              if (!teamRes.ok) {
                toast({
                  title: 'Error',
                  description: teamData?.error || 'Failed to load team-provided resolutions',
                  variant: 'destructive',
                });
                return;
              }
    
              teamOptions = (teamData?.resolutions || [])
                .map((r: any) => ({
                key: `member_provided:${r.id}`,
                label: r.title || r.description,
                resolutionText: r.description || r.title,
                resolutionId: typeof r.id === 'string' ? r.id : null,
                resolutionType: (r.resolutionType as ResolutionType) ?? ResolutionType.BASE,
                sourceType: CellSourceType.MEMBER_PROVIDED,
                sourceUserId: typeof r.ownerUserId === 'string' ? r.ownerUserId : null,
                isEmpty: false,
              }))
                // Prevent duplicates: do not allow selecting texts already used in other non-empty cells
                .filter((opt: EditOption) => !occupiedKeys.has(opt.key));
    
              const teamMemberUsernamesRes = await fetch(`/api/teams/${teamId}/members`);

              const teamMemberUsernamesData: { members?: Record<string, string>; error?: string } =
                await teamMemberUsernamesRes.json().catch(() => ({}));

              if (!teamMemberUsernamesRes.ok) {
                toast({
                  title: 'Error',
                  description: teamMemberUsernamesData?.error || 'Failed to load team member usernames',
                  variant: 'destructive',
                });
                return;
              }
              setUsernames(teamMemberUsernamesData.members ?? {});
            }
    
            setEditOptions([...teamOptions, ...personalOptions]);
          } catch {
            toast({
              title: 'Error',
              description: 'Failed to load replacement options',
              variant: 'destructive',
            });
          } finally {
            setIsEditOptionsLoading(false);
          }
        };
    
        loadEditOptions();
        // usernames is intentionally not a dependency to avoid re-loading options on username updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [isOpen, teamId, currentUserId, cellId, existingCells, toast]);

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
        setIsEditOptionsLoading(false);
        setIsSubmitting(false);
        setEditFilter('');
        setEditOptions([]);
        setUsernames({});
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
                            .map((opt) => {
                                const isMemberProvided = opt.sourceType === CellSourceType.MEMBER_PROVIDED;
                                const providerName = opt.sourceUserId ? (usernames[opt.sourceUserId] ?? 'Team member') : null;
                                const typeLabel = opt.resolutionType === ResolutionType.COMPOUND ? 'Complex'
                                  : opt.resolutionType === ResolutionType.ITERATIVE ? 'Iterative' : null;
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => handleSelectReplacement(opt)}
                                        disabled={isSubmitting}
                                        className={cn(
                                            'w-full text-left rounded-md border px-3 py-2 text-sm hover:bg-secondary/50 transition-colors',
                                            isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-medium leading-snug">{opt.label}</p>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {typeLabel && (
                                                    <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
                                                )}
                                                <Badge variant="outline" className="shrink-0">
                                                    {isMemberProvided ? (providerName ?? 'Member') : 'Personal'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                        {editOptions.length === 0 && (
                            <p className="text-sm text-muted-foreground">No options available.</p>
                        )}
                    </div>
                )}
            </div>
        </CellDialog>
    )
}