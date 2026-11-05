"use client";

/**
 * Teams Page
 * Spec Reference: 04-bingo-teams.md
 */

import { PageSpinner } from "@/components/page-spinner";
import { formatLeaderNames } from "@/components/team/leaders";
import type { Team } from "@/components/team/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from 'react';

export default function TeamsPage() {
  const t = useTranslations("Teams");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  usePageTitle(t("list.pageTitle"));

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
        title: tc("error"),
        description: t("list.loadFailed"),
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast, t, tc]);

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
        title: tc("success"),
        description: t("list.createdTitle"),
      });
    } else {
      toastApiError(result, t("list.createFailed"));
    }
    setIsCreating(false);
  };

  if (isLoading) {
    return (
      <PageSpinner />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {t("list.heading")}
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> {t("list.createButton")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline">{t("list.dialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("list.dialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">{t("list.nameLabel")}</Label>
                <Input
                  id="teamName"
                  placeholder={t("list.namePlaceholder")}
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isCreating && handleCreateTeam()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={handleCreateTeam} disabled={isCreating || !newTeamName.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("list.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map(team => {
            return (
              <Card key={team.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {team.name}
                  </CardTitle>
                  <CardDescription>
                    {t("list.ledBy", { names: formatLeaderNames(team.members, t("leaders.unknown")) })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm font-medium mb-2">{t("list.membersLabel")}</p>
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
                      {t("list.memberCount", { count: team.members.length })}
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={`/teams/${team.id}`}>{t("list.viewTeam")}</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-semibold font-headline">{t("list.emptyTitle")}</h3>
          <p className="text-muted-foreground mt-2 mb-4">{t("list.emptyText")}</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("list.createFirst")}
          </Button>
        </div>
      )}
    </div>
  );
}
