import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolutionToFormData } from "@/lib/shared/resolution-form";
import { RESOLUTION_TYPE_BADGE_VARIANTS, RESOLUTION_TYPE_LABELS } from "@/lib/shared/resolution-type";
import type { ResolutionFormData, ResolutionTypeValue } from "@/lib/shared/types";
import { Pencil, Plus, Send } from "lucide-react";
import { useState } from "react";
import type { Team, TeamProvidedResolution } from "../types";

interface ProposeResolutionsDialogProps {
  teamId: string;
  team: Team;
  currentUserId: string;
  existingResolutions: TeamProvidedResolution[];
  onReload: () => void;
}

/**
 * Propose Resolutions button, the dialog listing every other team member, and the
 * per-member create/edit dialog. Opening the dialog triggers a reload of the team data.
 * The edit state is kept while this component stays mounted.
 */
export function ProposeResolutionsDialog({
  teamId,
  team,
  currentUserId,
  existingResolutions,
  onReload,
}: ProposeResolutionsDialogProps) {
  const [memberResolutionsOpen, setMemberResolutionsOpen] = useState(false);
  // Per-member edit dialog
  const [editingMemberUserId, setEditingMemberUserId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState<string>('');
  const [editingMemberData, setEditingMemberData] = useState<ResolutionFormData | undefined>(undefined);
  const [memberEditDialogOpen, setMemberEditDialogOpen] = useState(false);

  /** Open the edit dialog for a specific member's proposed resolution. */
  const handleEditMemberResolution = (memberId: string, memberName: string) => {
    const existing = existingResolutions.find(r => r.toUserId === memberId);
    setEditingMemberUserId(memberId);
    setEditingMemberName(memberName);
    if (existing) {
      setEditingMemberData(resolutionToFormData(existing));
    } else {
      setEditingMemberData(undefined);
    }
    setMemberEditDialogOpen(true);
  };

  /** Called when a member-provided resolution is saved. */
  const handleMemberResolutionSaved = () => {
    setMemberEditDialogOpen(false);
    onReload();
  };

  return (
    <>
      <Button variant="outline" onClick={() => { setMemberResolutionsOpen(true); onReload(); }}>
        <Send className="h-4 w-4 mr-2" /> Propose Resolutions
      </Button>

      {/* ── Propose Resolutions Dialog ─────────────────────────── */}
      <Dialog open={memberResolutionsOpen} onOpenChange={setMemberResolutionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Propose Resolutions</DialogTitle>
            <DialogDescription>
              Create or update a resolution for each team member. You can do this at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-96 overflow-y-auto">
            {team.members
              .filter(m => m.user.userId !== currentUserId)
              .map(member => {
                const existing = existingResolutions.find(r => r.toUserId === member.user.userId);
                const memberName = member.user.displayName || member.user.username;
                return (
                  <MemberResolutionRow
                    key={member.user.userId}
                    memberName={memberName}
                    resolution={existing ?? null}
                    onEdit={() => handleEditMemberResolution(member.user.userId, memberName)}
                  />
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Member Resolution Edit Dialog ──────────────────────── */}
      {editingMemberUserId && (
        <ResolutionCreateEditDialog
          key={editingMemberData?.id ?? `new-${editingMemberUserId}`}
          initialData={editingMemberData}
          isOpen={memberEditDialogOpen}
          setIsOpen={setMemberEditDialogOpen}
          onSaved={handleMemberResolutionSaved}
          scope="member_provided"
          teamId={teamId}
          toUserId={editingMemberUserId}
          recipientName={editingMemberName}
        />
      )}
    </>
  );
}

/* ─── MemberResolutionRow ────────────────────────────────────────── */

interface MemberResolutionRowProps {
  memberName: string;
  resolution: TeamProvidedResolution | null;
  onEdit: () => void;
}

/**
 * A single row in the Propose Resolutions dialog.
 * Shows member name and their resolution (title + type badge), or a prompt to add one.
 */
function MemberResolutionRow({ memberName, resolution, onEdit }: MemberResolutionRowProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">For {memberName}</p>
        {resolution ? (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm truncate">{resolution.title}</span>
            <Badge
              variant={RESOLUTION_TYPE_BADGE_VARIANTS[resolution.resolutionType as ResolutionTypeValue]}
              className="text-xs flex-shrink-0"
            >
              {RESOLUTION_TYPE_LABELS[resolution.resolutionType as ResolutionTypeValue]}
            </Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">No resolution proposed yet</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"
        onClick={onEdit}
        aria-label={resolution ? "Edit resolution" : "Add resolution"}
      >
        {resolution ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}
