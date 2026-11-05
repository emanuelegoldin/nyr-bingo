"use client";

import { useTeamWs } from "@/components/team-ws-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { useToast } from "@/hooks/use-toast";
import { useWsRoom } from "@/hooks/use-ws-room";
import { apiFetch } from "@/lib/api-client";
import type { ResolutionHistoryEntry } from "@/lib/db/types";
import { History, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

/** History entry as received from the API, with its date serialized. */
type HistoryEntry = Omit<ResolutionHistoryEntry, "createdAt"> & { createdAt: string };

interface ResolutionHistoryDialogProps {
  cellId: string;
  resolutionTitle: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const ResolutionHistoryDialog = ({
  cellId,
  resolutionTitle,
  isOpen,
  setIsOpen,
}: ResolutionHistoryDialogProps) => {
  const t = useTranslations("ResolutionHistoryDialog");
  const tc = useTranslations("Common");
  const format = useFormatter();
  const { teamId } = useTeamWs();
  const toastApiError = useApiErrorToast();
  const { toast } = useToast();

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [canWrite, setCanWrite] = useState(false);

  const canSubmit = draft.trim().length > 0 && canWrite && !saving;

  const loadHistory = useCallback(async () => {
    if (!cellId) return;
    setLoading(true);
    const result = await apiFetch<{ entries?: unknown; canWrite?: boolean }>(
      `/api/cells/${cellId}/history?limit=100&offset=0`,
    );
    if (result.ok) {
      setEntries(Array.isArray(result.data.entries) ? (result.data.entries as HistoryEntry[]) : []);
      setCanWrite(Boolean(result.data.canWrite));
    } else {
      toastApiError(result, t('loadError'));
    }
    setLoading(false);
  }, [cellId, toastApiError, t]);

  useEffect(() => {
    if (!isOpen) return;
    loadHistory();
  }, [isOpen, loadHistory]);

  useWsRoom(teamId ? { type: "card", id: teamId } : null, loadHistory, isOpen && Boolean(cellId));

  const handleAddEntry = useCallback(async () => {
    if (!canSubmit) return;

    setSaving(true);
    try {
      const result = await apiFetch<unknown>(`/api/cells/${cellId}/history`, {
        method: "POST",
        json: { content: draft.trim() },
      });
      if (!result.ok) {
        toastApiError(result, t('addError'));
        return;
      }

      setDraft("");
      await loadHistory();
    } catch {
      toast({
        title: tc("error"),
        description: t('addError'),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [canSubmit, draft, loadHistory, cellId, toast, toastApiError, tc, t]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t("description", { title: resolutionTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {canWrite && (
            <div className="space-y-2 border rounded-md p-3 bg-secondary/20">
              <p className="text-sm font-medium">{t('addNoteTitle')}</p>
              <Textarea
                placeholder={t('addNotePlaceholder')}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                disabled={saving}
              />
              <div className="flex justify-end">
                <Button onClick={handleAddEntry} disabled={!canSubmit}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('addNoteButton')}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('loading')}</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('empty')}
              </p>
            ) : (
              <ul className="space-y-2 max-h-[45vh] overflow-y-auto">
                {entries.map((entry) => (
                  <li key={entry.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={entry.entryType === "manual_note" ? "secondary" : "outline"}>
                          {entry.entryType === "manual_note" ? t('noteLabel') : t('progressLabel')}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {entry.authorUsername}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format.dateTime(new Date(entry.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{entry.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
