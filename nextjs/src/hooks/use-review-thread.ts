"use client";

import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { ReviewFile, ReviewThreadWithDetails } from "@/lib/db/types";
import { useEffect, useRef, useState } from "react";

/**
 * Builds the URL of the websocket endpoint for the current page.
 *
 * @returns The websocket URL, or null when not running in a browser.
 */
function getWsUrl(): string | null {
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return null;
}

interface UseReviewThreadOptions {
  /** Called after a successful mutation so the parent can reload the card. */
  onRefresh?: () => void;
  /** Opens or closes the dialog that hosts the thread. */
  setIsOpen: (isOpen: boolean) => void;
}

/**
 * Owns the state of a review thread dialog: the thread itself, fetching it,
 * the thread's own WebSocket room and every mutation (message, file upload,
 * file delete, vote notification, close).
 *
 * @param reviewThreadId - Thread id taken from the cell (may be empty).
 * @param isOpen - Whether the dialog is open; the socket and loading depend on it.
 * @param options - Parent callbacks (`onRefresh`, `setIsOpen`).
 * @returns Thread state, form drafts and the mutation handlers.
 */
export const useReviewThread = (
  reviewThreadId: string,
  isOpen: boolean,
  { onRefresh, setIsOpen }: UseReviewThreadOptions
) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thread, setThread] = useState<ReviewThreadWithDetails | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const { toast } = useToast();
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const currentThreadId = reviewThreadId || thread?.id;

  /**
   * Fetches the thread and stores it.
   *
   * @param silent - When true (refresh), the loading flag is not touched and
   * a failure reports "Failed to refresh review thread". When false (initial
   * load), the loading flag is set and a failure reports "Failed to load review thread".
   */
  const fetchThread = async (silent: boolean) => {
    const threadId = currentThreadId;
    if (!threadId) return;

    if (!silent) setIsThreadLoading(true);
    const result = await apiFetch<{ thread: ReviewThreadWithDetails }>(`/api/threads/${threadId}`);
    if (result.ok) {
      setThread(result.data.thread);
    } else {
      toast({
        title: 'Error',
        description: result.error || (silent ? 'Failed to refresh review thread' : 'Failed to load review thread'),
        variant: 'destructive',
      });
    }
    if (!silent) setIsThreadLoading(false);
  };

  /** Re-reads the thread without showing the loading state. */
  const refetchThread = () => fetchThread(true);

  /**
   * Tells the other thread participants to refetch, if the socket is open.
   *
   * @param threadId - The thread room to notify.
   */
  const notifyThreadRoom = (threadId: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const wsMessage: ThreadRefreshMessage = {
        type: 'thread-refresh',
        body: { threadId },
      };
      ws.send(JSON.stringify(wsMessage));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadCurrentUsername = async () => {
      // Failures are ignored on purpose
      const result = await apiFetch<{ user?: { username?: unknown; id?: unknown } }>('/api/profile');
      if (!result.ok) return;
      const username = result.data?.user?.username;
      const userId = result.data?.user?.id;
      if (!cancelled && typeof username === 'string' && username) {
        setCurrentUsername(username);
      }
      if (!cancelled && typeof userId === 'string' && userId) {
        setCurrentUserId(userId);
      }
    };

    loadCurrentUsername();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const threadId = currentThreadId;
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
  }, [reviewThreadId, isOpen, thread?.id]);

  useEffect(() => {
    if (!isOpen) return;
    fetchThread(false);
  }, [reviewThreadId, isOpen, thread?.id, toast]);

  /** Uploads the selected file to the thread (owner only, enforced by the API). */
  const uploadFile = async () => {
    const threadId = currentThreadId;
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
      notifyThreadRoom(threadId);
      setSelectedFile(null);
      onRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Posts the trimmed message draft to the thread. */
  const sendMessage = async () => {
    const threadId = currentThreadId;
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

      notifyThreadRoom(threadId);
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

  /**
   * Deletes a file from the thread.
   *
   * @param fileId - Id of the review file to delete.
   */
  const deleteFile = async (fileId: string) => {
    const threadId = currentThreadId;
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

      notifyThreadRoom(threadId);

      onRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Closes the thread after confirmation, then closes the dialog. */
  const closeThread = async () => {
    const threadId = currentThreadId;
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

      notifyThreadRoom(threadId);

      onRefresh?.();
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Runs after VoteBar persisted a vote: notify the room, refetch, then call `onRefresh`. */
  const handleVoteSubmitted = () => {
    const tid = currentThreadId;
    if (tid) notifyThreadRoom(tid);
    refetchThread();
    // onRefresh is wrapped by BingoCard to broadcast a
    // card-refresh after the async reload completes.
    // This covers vote outcomes that change cell state
    // (e.g. accomplished or reverted to pending).
    onRefresh?.();
  };

  return {
    thread,
    isThreadLoading,
    isSubmitting,
    currentUserId,
    messageDraft,
    setMessageDraft,
    selectedFile,
    setSelectedFile,
    uploadFile,
    sendMessage,
    deleteFile,
    closeThread,
    handleVoteSubmitted,
  };
};
