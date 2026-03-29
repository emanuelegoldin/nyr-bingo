"use client";

import { ReviewFile, ReviewMessageAndAuthor, ReviewThreadWithDetails } from "@/lib/db/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { CellDialog } from "./cell-dialog"
import { VoteBar } from "./vote-bar";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

function getWsUrl(): string | null {
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return null;
}

interface CellThreadDialogProps {
  cell: {
    id: string,
    resolutionText: string,
    reviewThreadId: string
  }
  isOwner: boolean,
  isOpen: boolean,
  setIsOpen: (isOpen: boolean) => void,
  onRefresh?: () => void
}

export const CellThreadDialog = ({
  cell,
  isOwner,
  isOpen,
  setIsOpen,
  onRefresh
}: CellThreadDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thread, setThread] = useState<ReviewThreadWithDetails | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const refetchThread = async () => {
    const threadId = cell.reviewThreadId || thread?.id;
    if (!threadId) return;

    try {
      const res = await fetch(`/api/threads/${threadId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to refresh review thread',
          variant: 'destructive',
        });
        return;
      }
      setThread(data.thread);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to refresh review thread',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadCurrentUsername = async () => {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json().catch(() => ({}));
        const username = data?.user?.username;
        const userId = data?.user?.id;
        if (!cancelled && res.ok && typeof username === 'string' && username) {
          setCurrentUsername(username);
        }
        if (!cancelled && res.ok && typeof userId === 'string' && userId) {
          setCurrentUserId(userId);
        }
      } catch {
        // ignore
      }
    };

    loadCurrentUsername();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const threadId = cell.reviewThreadId || thread?.id;
    if (!threadId) return;

    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const joinMessage: JoinThreadWSMessage = {
        type: 'join-thread',
        body: { threadId },
      };
      ws.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = () => { refetchThread(); };

    ws.onerror = (e) => {
      console.error('WebSocket error occurred:', e);
    };

    return () => {
      if (wsRef.current === ws) wsRef.current = null;
      try {
        ws.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
    };
  }, [cell.reviewThreadId, isOpen, thread?.id]);

  useEffect(() => {
    const loadThread = async () => {
      if (!isOpen) return;
      const threadId = (cell.reviewThreadId || thread?.id) as string | undefined;
      if (!threadId) return;

      setIsThreadLoading(true);
      try {
        const res = await fetch(`/api/threads/${threadId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({
            title: 'Error',
            description: data?.error || 'Failed to load review thread',
            variant: 'destructive',
          });
          return;
        }
        setThread(data.thread);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load review thread',
          variant: 'destructive',
        });
      } finally {
        setIsThreadLoading(false);
      }
    };

    loadThread();
  }, [cell.reviewThreadId, isOpen, thread?.id, toast]);

  const handleUploadClick = () => {
    if (isSubmitting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };



  const handleUploadFileToThread = async () => {
    const threadId = cell.reviewThreadId || thread?.id;
    if (!threadId) return;
    if (!selectedFile) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.set('file', selectedFile);

      const res = await fetch(`/api/threads/${threadId}/files`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to upload file',
          variant: 'destructive',
        });
        return;
      }
      // If succesful, res.file contains the uploaded file info.
      const uploadedFile = data.file as ReviewFile | undefined;
      if (!uploadedFile) {
        toast({
          title: 'Error',
          description: 'File uploaded but response is missing file info',
          variant: 'destructive',
        });
        return;
      }
      // Optimistically update thread with new file - TODO: should we prefer pessimistic update?
      if (thread) {
        setThread({
          ...thread,
          files: [...(thread.files || []), uploadedFile],
        });
      }
      // Broadcast new file to other thread participants via WebSocket
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && uploadedFile) {
        const wsMessage: ThreadRefreshMessage = {
          type: 'thread-refresh',
          body: {
            threadId: threadId
          },
        };
        ws.send(JSON.stringify(wsMessage));
      }
      setSelectedFile(null);
      onRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    const threadId = cell.reviewThreadId || thread?.id;
    if (!threadId) return;
    if (isSubmitting) return;

    const content = messageDraft.trim();
    if (!content) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to post message',
          variant: 'destructive',
        });
        return;
      }

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const wsMessage: ThreadRefreshMessage = {
          type: 'thread-refresh',
          body: {
            threadId,
          },
        };
        ws.send(JSON.stringify(wsMessage));
      }
      // Optimistic update of sent message - TODO: should we prefer pessimistic update?
      if (thread) {
        setThread({
          ...thread,
          messages: [...(thread.messages || []), { id: `temp-${Date.now()}`, authorUsername: currentUsername ?? 'User', content }],
        });
      }
      setMessageDraft('');
      onRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFileFromThread = async (fileId: string) => {
    const threadId = cell.reviewThreadId || thread?.id;
    if (!threadId) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to delete file',
          variant: 'destructive',
        });
        return;
      }

      if (thread) {
        setThread({
          ...thread,
          files: (thread.files || []).filter((f) => f.id !== fileId),
        });
      }

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const wsMessage: ThreadRefreshMessage = {
          type: 'thread-refresh',
          body: { threadId },
        };
        ws.send(JSON.stringify(wsMessage));
      }

      onRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseThread = async () => {
    const threadId = cell.reviewThreadId || thread?.id;
    if (!threadId) return;
    if (isSubmitting) return;
    // TODO: Use modal for confirmation.
    const confirmed = window.confirm(
      'Close this thread and revert the resolution to pending? This will delete all thread files and messages.'
    );
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/threads/${threadId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to close thread',
          variant: 'destructive',
        });
        return;
      }

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const wsMessage: ThreadRefreshMessage = {
          type: 'thread-refresh',
          body: { threadId },
        };
        ws.send(JSON.stringify(wsMessage));
      }

      onRefresh?.();
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CellDialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title="Review Thread"
      description={`Discussion, files, and voting for "${cell.resolutionText}".`}
    >
      <div className="space-y-4 py-4">
        {isThreadLoading ? (
          <p className="text-sm text-muted-foreground">Loading thread…</p>
        ) : thread ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Status</p>
                <Badge variant="outline">{thread.status}</Badge>
              </div>
              {isOwner && thread.status === 'open' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCloseThread}
                  disabled={isSubmitting}
                >
                  Close Thread
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Files</p>
              {thread.files?.length ? (
                <div className="space-y-1">
                  {thread.files.map((f: ReviewFile) => (
                    <div key={f.id} className="flex items-center justify-between gap-2">
                      <a
                        href={f.filePath}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm underline truncate"
                      >
                        {f.fileName}
                      </a>
                      {isOwner && thread.status === 'open' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void handleDeleteFileFromThread(f.id);
                          }}
                          disabled={isSubmitting}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No files yet</p>
              )}

              {isOwner && thread.status === 'open' && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf,video/*"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" size="sm" onClick={handleUploadClick} disabled={isSubmitting}>
                      Choose File
                    </Button>
                    {selectedFile ? (
                      <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No file selected</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUploadFileToThread}
                    disabled={isSubmitting || !selectedFile}
                  >
                    Upload
                  </Button>
                </>
              )}
            </div>

            <VoteBar
              threadId={(cell.reviewThreadId || thread.id) as string}
              votes={thread.votes ?? []}
              currentUserId={currentUserId}
              threadOpen={thread.status === 'open'}
              canVote={!isOwner}
              onVoteSubmitted={() => {
                const ws = wsRef.current;
                const tid = cell.reviewThreadId || thread.id;
                if (ws && ws.readyState === WebSocket.OPEN && tid) {
                  const wsMessage: ThreadRefreshMessage = {
                    type: 'thread-refresh',
                    body: { threadId: tid },
                  };
                  ws.send(JSON.stringify(wsMessage));
                }
                refetchThread();
                // onRefresh is wrapped by BingoCard to broadcast a
                // card-refresh after the async reload completes.
                // This covers vote outcomes that change cell state
                // (e.g. accomplished or reverted to pending).
                onRefresh?.();
              }}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Messages</p>
              {thread.messages?.length ? (
                <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-2">
                  {thread.messages.map((m: ReviewMessageAndAuthor) => {
                    return (
                      <div key={m.id} className="text-sm">
                        <p className="text-xs text-muted-foreground">{m.authorUsername ?? 'User'}</p>
                        <p>{m.content}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No messages yet</p>
              )}

              <Textarea
                placeholder="Write a message…"
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                disabled={isSubmitting || thread.status !== 'open'}
                rows={3}
              />
              <Button onClick={handleSendMessage} disabled={isSubmitting || thread.status !== 'open'}>
                Send
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Thread not available.</p>
        )}
      </div>
    </CellDialog>
  );
}