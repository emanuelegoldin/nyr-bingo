"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTeamWs } from "@/components/team-ws-provider";
import type { WsIncomingMessage } from "@/components/team-ws-provider";
import { useTranslations } from "next-intl";

interface HistoryEntry {
  id: string;
  authorUserId: string;
  authorUsername: string;
  entryType: "manual_note" | "system_event";
  eventKey: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ResolutionHistoryDialogProps {
  resolutionId: string;
  resolutionTitle: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const ResolutionHistoryDialog = ({
  resolutionId,
  resolutionTitle,
  isOpen,
  setIsOpen,
}: ResolutionHistoryDialogProps) => {
  const t = useTranslations("ResolutionHistoryDialog");
  const { toast } = useToast();
  const { sendWsMessage, addMessageListener } = useTeamWs();

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [canWrite, setCanWrite] = useState(false);

  const canSubmit = draft.trim().length > 0 && canWrite && !saving;

  const loadHistory = useCallback(async () => {
    if (!resolutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/resolutions/${resolutionId}/history?limit=100&offset=0`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Error",
          description: data?.error || t("loadError"),
          variant: "destructive",
        });
        return;
      }
      setEntries(Array.isArray(data.entries) ? (data.entries as HistoryEntry[]) : []);
      setCanWrite(Boolean(data.canWrite));
    } catch {
      toast({
        title: "Error",
        description: t("loadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [resolutionId, toast]);

  useEffect(() => {
    if (!isOpen) return;
    loadHistory();
  }, [isOpen, loadHistory]);

  useEffect(() => {
    if (!isOpen || !resolutionId) return;

    sendWsMessage({
      type: "join-resolution-room",
      body: { resolutionId },
    });

    const unsubscribe = addMessageListener((msg: WsIncomingMessage) => {
      if (msg.type === "refresh-resolution" && msg.resolutionId === resolutionId) {
        loadHistory();
      }
    });

    return unsubscribe;
  }, [isOpen, resolutionId, sendWsMessage, addMessageListener, loadHistory]);

  const handleAddEntry = useCallback(async () => {
    if (!canSubmit) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/resolutions/${resolutionId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Error",
          description: data?.error || t("addError"),
          variant: "destructive",
        });
        return;
      }

      setDraft("");
      await loadHistory();
      sendWsMessage({
        type: "resolution-refresh",
        body: { resolutionId },
      });
    } catch {
      toast({
        title: "Error",
        description: t("addError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [canSubmit, draft, loadHistory, resolutionId, sendWsMessage, toast]);

  const orderedEntries = useMemo(() => entries, [entries]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <History className="h-4 w-4" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description", { title: resolutionTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {canWrite && (
            <div className="space-y-2 border rounded-md p-3 bg-secondary/20">
              <p className="text-sm font-medium">{t("addNoteTitle")}</p>
              <Textarea
                placeholder={t("addNotePlaceholder")}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                disabled={saving}
              />
              <div className="flex justify-end">
                <Button onClick={handleAddEntry} disabled={!canSubmit}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t("addNoteButton")}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("loading")}</p>
            ) : orderedEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("empty")}
              </p>
            ) : (
              <ul className="space-y-2 max-h-[45vh] overflow-y-auto">
                {orderedEntries.map((entry) => (
                  <li key={entry.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={entry.entryType === "manual_note" ? "secondary" : "outline"}>
                          {entry.entryType === "manual_note" ? t("noteLabel") : t("progressLabel")}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {entry.authorUsername}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
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
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
