"use client";

/**
 * Team Detail Page
 * Spec Reference: 04-bingo-teams.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md, 12-team-tabs.md
 *
 * The page is organised into three tabs:
 *   1. Cards   — bingo cards for every member (existing functionality)
 *   2. Members — simple member list with clickable avatars
 *   3. Leaderboard — ranked table of first-bingo times
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Crown, Send, Settings, Swords, Copy, UserPlus, Loader2, Check, Trash2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useSetAppHeaderTitle } from "@/components/app-header-title";
import {
  ResolutionCreateEditDialog,
  type ResolutionFormData,
} from "@/components/dialogs/resolution-create-edit-dialog";

import { CardsTab } from "./cards-tab";
import { MembersTab } from "./members-tab";
import { LeaderboardTab } from "./leaderboard-tab";
import type { Team, BingoCardData, TeamProvidedResolution } from "./types";

export default function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  useSetAppHeaderTitle("Team");

  const { toast } = useToast();
  const router = useRouter();
  const [teamId, setTeamId] = useState<string>('');
  const [team, setTeam] = useState<Team | null>(null);
  const [cards, setCards] = useState<BingoCardData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  // Delete team dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Team goal resolution
  const [teamGoal, setTeamGoal] = useState<ResolutionFormData | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  
  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Member resolutions dialog
  const [memberResolutionsOpen, setMemberResolutionsOpen] = useState(false);
  const [existingResolutions, setExistingResolutions] = useState<TeamProvidedResolution[]>([]);
  // Per-member edit dialog
  const [editingMemberUserId, setEditingMemberUserId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState<string>('');
  const [editingMemberData, setEditingMemberData] = useState<ResolutionFormData | undefined>(undefined);
  const [memberEditDialogOpen, setMemberEditDialogOpen] = useState(false);

  useEffect(() => {
    params.then(p => setTeamId(p.teamId));
  }, [params]);

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    
    try {
      // Get current user
      const profileRes = await fetch('/api/profile');
      const profileData = await profileRes.json();
      if (profileRes.ok && profileData.user) {
        setCurrentUserId(profileData.user.id);
      }

      // Get team details
      const response = await fetch(`/api/teams/${teamId}`);
      const data = await response.json();
      
      if (response.ok) {
        setTeam(data.team);
        
        // Get bingo cards if game started
        if (data.team.status === 'started') {
          const cardsRes = await fetch(`/api/teams/${teamId}/cards`);
          const cardsData = await cardsRes.json();
          if (cardsRes.ok) {
            setCards(cardsData.cards || []);
          }
        }
        
        // Get team goal resolution
        const goalRes = await fetch(`/api/teams/${teamId}/goal`);
        const goalData = await goalRes.json();
        if (goalRes.ok && goalData.goal) {
          setTeamGoal({
            id: goalData.goal.id,
            type: goalData.goal.type,
            title: goalData.goal.title,
            text: goalData.goal.text ?? '',
            subtasks: goalData.goal.subtasks,
            numberOfRepetition: goalData.goal.numberOfRepetition,
          });
        } else {
          setTeamGoal(null);
        }
        
        // Get existing member-provided resolutions
        const resRes = await fetch(`/api/teams/${teamId}/resolutions`);
        const resData = await resRes.json();
        if (resRes.ok) {
          setExistingResolutions(resData.createdByUser || []);
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load team",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [teamId, toast]);

  useEffect(() => {
    if (teamId) {
      loadTeam();
    }
  }, [teamId, loadTeam]);

  const isLeader = team?.leaderUserId === currentUserId;
  const leader = team?.members.find(m => m.membership.role === 'leader');

  /** Called when team goal is saved via the resolution dialog. */
  const handleGoalSaved = () => {
    setGoalDialogOpen(false);
    loadTeam();
  };

  /** Open the edit dialog for a specific member's proposed resolution. */
  const handleEditMemberResolution = (memberId: string, memberName: string) => {
    const existing = existingResolutions.find(r => r.toUserId === memberId);
    setEditingMemberUserId(memberId);
    setEditingMemberName(memberName);
    if (existing) {
      setEditingMemberData({
        id: existing.id,
        type: existing.resolutionType as ResolutionFormData['type'],
        title: existing.title,
        text: existing.description ?? '',
        subtasks: existing.subtasks ?? undefined,
        numberOfRepetition: existing.numberOfRepetition ?? undefined,
      });
    } else {
      setEditingMemberData(undefined);
    }
    setMemberEditDialogOpen(true);
  };

  /** Called when a member-provided resolution is saved. */
  const handleMemberResolutionSaved = () => {
    setMemberEditDialogOpen(false);
    loadTeam();
  };

  const handleCreateInvite = async () => {
    setIsCreatingInvite(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (response.ok) {
        setInviteCode(data.invitation.inviteCode);
        toast({
          title: "Success",
          description: "Invite link created",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create invite",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartBingo = async () => {
    setIsStarting(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/start`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bingo game started!",
        });
        loadTeam(); // Reload to show cards
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to start game",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!teamId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/teams/${teamId}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response
        .json()
        .catch(() => ({} as { error?: string }));

      if (response.ok) {
        setDeleteDialogOpen(false);
        toast({
          title: 'Team deleted',
          description: 'The team and its related data were removed.',
        });
        router.push('/teams');
        router.refresh();
        return;
      }

      toast({
        title: 'Error',
        description: data?.error || 'Failed to delete team',
        variant: 'destructive',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };
 // TODO: consider moving the cell update logic at Card or Cell level
  const handleCellUpdate = async (cellId: string, newState: 'pending' | 'completed') => {
    try {
      const response =
        newState === 'pending'
          ? await fetch(`/api/cells/${cellId}/undo-complete`, { method: 'POST' })
          : await fetch(`/api/cells/${cellId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: newState }),
            });

      if (response.ok) {
        // Refresh cards
        const cardsRes = await fetch(`/api/teams/${teamId}/cards`);
        const cardsData = await cardsRes.json();
        if (cardsRes.ok) {
          setCards(cardsData.cards || []);
        }
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update cell",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const reloadCards = async () => {
    const cardsRes = await fetch(`/api/teams/${teamId}/cards`);
    const cardsData = await cardsRes.json();
    if (cardsRes.ok) {
      setCards(cardsData.cards || []);
    }
  };

  if (!team) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Team not found</h1>
        <p className="text-muted-foreground">The team you are looking for does not exist.</p>
        <Button asChild variant="link"><Link href="/teams">Back to Teams</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="font-headline text-3xl">{team.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Team Leader: {leader?.user.displayName || leader?.user.username || 'Unknown'}
            </CardDescription>
            <div className="mt-2">
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                team.status === 'started' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {team.status === 'started' ? 'Game Started' : 'Forming Team'}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isLeader && (
              <>
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="h-4 w-4 mr-2" /> Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Members</DialogTitle>
                      <DialogDescription>
                        Create an invite link to share with your friends.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {!inviteCode ? (
                        <Button onClick={handleCreateInvite} disabled={isCreatingInvite}>
                          {isCreatingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Generate Invite Link
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Label>Invite Link</Label>
                          <div className="flex gap-2">
                            <Input 
                              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`}
                              readOnly
                            />
                            <Button onClick={copyInviteLink} variant="outline">
                              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" /> Set Goal
                </Button>

                {team.status !== 'started' && (
                  <Button onClick={handleStartBingo} disabled={isStarting}>
                    {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Swords className="h-4 w-4 mr-2" /> Start Bingo
                  </Button>
                )}
              </>
            )}

            {isLeader && (
              <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={(open: boolean) => {
                  if (!isDeleting) setDeleteDialogOpen(open);
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Team
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this team?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the team, its memberships, invitations, team-provided resolutions,
                      bingo cards, and related gameplay data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                      <Button variant="outline" disabled={isDeleting}>
                        Cancel
                      </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button variant="destructive" onClick={handleDeleteTeam} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button variant="outline" onClick={() => { setMemberResolutionsOpen(true); loadTeam(); }}>
              <Send className="h-4 w-4 mr-2"/> Propose Resolutions
            </Button>
          </div>
        </CardHeader>

        {/* ── Team Goal Display ─────────────────────────────────── */}
        <CardContent>
          <TeamGoalDisplay
            goal={teamGoal}
            isLeader={isLeader}
            onEdit={() => setGoalDialogOpen(true)}
          />
        </CardContent>
      </Card>

      {/* ── Team Goal Resolution Dialog ────────────────────────── */}
      <ResolutionCreateEditDialog
        key={teamGoal?.id ?? 'new-goal'}
        initialData={teamGoal ?? undefined}
        isOpen={goalDialogOpen}
        setIsOpen={setGoalDialogOpen}
        onSaved={handleGoalSaved}
        scope="team"
        teamId={teamId}
      />

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

      {/* ── Tab navigation ────────────────────────────────────── */}
      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-6">
          <CardsTab
            team={team}
            cards={cards}
            currentUserId={currentUserId}
            onCellUpdate={handleCellUpdate}
            onRefresh={reloadCards}
          />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersTab team={team} currentUserId={currentUserId} />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <LeaderboardTab teamId={teamId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Human-readable labels ──────────────────────────────────────── */

type ResolutionTypeValue = "base" | "compound" | "iterative";

const TYPE_LABELS: Record<ResolutionTypeValue, string> = {
  base: "Common",
  compound: "Complex",
  iterative: "Iterative",
};

const TYPE_VARIANT: Record<ResolutionTypeValue, "default" | "secondary" | "outline"> = {
  base: "secondary",
  compound: "default",
  iterative: "outline",
};

/* ─── TeamGoalDisplay ────────────────────────────────────────────── */

interface TeamGoalDisplayProps {
  goal: ResolutionFormData | null;
  isLeader: boolean;
  onEdit: () => void;
}

/**
 * Shows the team goal inline. Leader sees an edit button.
 * All members see the title, type badge, description, and type-specific details.
 */
function TeamGoalDisplay({ goal, isLeader, onEdit }: TeamGoalDisplayProps) {
  if (!goal) {
    return (
      <p className="text-sm text-muted-foreground">
        {isLeader
          ? 'No team goal set yet. Click "Set Goal" to define one.'
          : "No team goal set yet."}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Team Goal:</span>
        <span className="text-sm font-medium">{goal.title}</span>
        <Badge variant={TYPE_VARIANT[goal.type]} className="text-xs">
          {TYPE_LABELS[goal.type]}
        </Badge>
        {isLeader && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label="Edit team goal"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {goal.text && goal.text !== goal.title && (
        <p className="text-xs text-muted-foreground">{goal.text}</p>
      )}
      {goal.type === "compound" && goal.subtasks && (
        <p className="text-xs text-muted-foreground">
          {goal.subtasks.filter(s => s.completed).length} / {goal.subtasks.length} subtasks
        </p>
      )}
      {goal.type === "iterative" && goal.numberOfRepetition !== undefined && (
        <p className="text-xs text-muted-foreground">
          Target: {goal.numberOfRepetition} repetitions
        </p>
      )}
    </div>
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
              variant={TYPE_VARIANT[resolution.resolutionType as ResolutionTypeValue]}
              className="text-xs flex-shrink-0"
            >
              {TYPE_LABELS[resolution.resolutionType as ResolutionTypeValue]}
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
