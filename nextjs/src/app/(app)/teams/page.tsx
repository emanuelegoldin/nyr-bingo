"use client";

/**
 * Teams Page
 * Spec Reference: 04-bingo-teams.md
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from 'react';
import type { Team } from './[teamId]/types';

export default function TeamsPage() {
  const { setTitle } = useAppContext();
  setTitle("Teams");

  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadTeams = useCallback(async () => {
    const result = await apiFetch<{ teams?: Team[] }>('/api/teams');
    if (result.ok) {
      setTeams(result.data.teams || []);
    } else if (result.status === 0) {
      // No usable response (network failure or non-JSON body)
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    setIsCreating(true);
    const result = await apiFetch<{ team: Team }>('/api/teams', {
      method: 'POST',
      json: { name: newTeamName },
    });

    if (result.ok) {
      setTeams([result.data.team, ...teams]);
      setNewTeamName("");
      setDialogOpen(false);
      toast({
        title: "Success",
        description: "Team created successfully",
      });
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || "Failed to create team",
        variant: "destructive",
      });
    }
    setIsCreating(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          My Teams
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline">Create New Team</DialogTitle>
              <DialogDescription>
                Create a new bingo team and invite your friends to join.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  placeholder="e.g., Goal Getters 2025"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isCreating && handleCreateTeam()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeam} disabled={isCreating || !newTeamName.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Team
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map(team => {
            const leader = team.members.find(m => m.membership.role === 'leader');
            return (
              <Card key={team.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {team.name}
                  </CardTitle>
                  <CardDescription>
                    Led by {leader?.user.displayName || leader?.user.username || 'Unknown'}
                  </CardDescription>
                  <div className="mt-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${team.status === 'started'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                      {team.status === 'started' ? 'Game Started' : 'Forming Team'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm font-medium mb-2">Team Members:</p>
                  <div className="flex items-center space-x-2">
                    <div className="flex -space-x-2 overflow-hidden">
                      {team.members.map(member => (
                        <Avatar key={member.user.userId} className="inline-block h-8 w-8 rounded-full border-2 border-card">
                          <AvatarFallback>
                            {(member.user.displayName || member.user.username)?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {team.members.length} members
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={`/teams/${team.id}`}>View Team</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-semibold font-headline">No Teams Yet</h3>
          <p className="text-muted-foreground mt-2 mb-4">You're not part of any team. Create one to get started!</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Your First Team
          </Button>
        </div>
      )}
    </div>
  );
}
