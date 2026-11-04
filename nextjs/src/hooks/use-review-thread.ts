"use client";

import { useToast } from "@/hooks/use-toast";
import { useWsRoom } from "@/hooks/use-ws-room";
import { apiFetch, toastApiError } from "@/lib/api-client";
import { ReviewFile, ReviewThreadWithDetails } from "@/lib/db/types";
import { useEffect, useState } from "react";

interface UseReviewThreadOptions {
  /** Called after a successful mutation so the parent can reload the card. */
  onRefresh?: () => void;
  /** Opens or closes the dialog that hosts the thread. */
  setIsOpen: (isOpen: boolean) => void;
  /** Name shown on the viewer's own message until the thread is re-read. */
  currentUsername?: string;
}

/**
 * Owns the state of a review thread dialog: the thread itself, fetching it,
 * its WebSocket room and every mutation (message, file upload,
 * file delete, vote notification, close).
 *
 * @param reviewThreadId - Thread id taken from the cell (may be empty).
 * @param isOpen - Whether the dialog is open; the socket and loading depend on it.
 * @param options - Parent callbacks (`onRefresh`, `setIsOpen`) and the viewer's name.
 * @returns Thread state, form drafts and the mutation handlers.
 */
export const useReviewThread = (
  reviewThreadId: string,
  isOpen: boolean,
  { onRefresh, setIsOpen, currentUsername }: UseReviewThreadOptions
) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thread, setThread] = useState<ReviewThreadWithDetails | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const { toast } = useToast();

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
      toastApiError(result, silent ? 'Failed to refresh review thread' : 'Failed to load review thread');
    }
    if (!silent) setIsThreadLoading(false);
  };

  /** Re-reads the thread without showing the loading state. */
  const refetchThread = () => fetchThread(true);

  useWsRoom(currentThreadId ? { type: 'thread', id: currentThreadId } : null, refetchThread, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    fetchThread(false);
    // fetchThread only depends on currentThreadId, which the first fetch leaves unchanged
  }, [currentThreadId, isOpen]);

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

      const result = await apiFetch<{ file?: ReviewFile }>(`/api/threads/${threadId}/files`, {
        method: 'POST',
        body: form,
      });
      if (!result.ok) {
        toastApiError(result, 'Failed to upload file');
        return;
      }
      // If succesful, the response contains the uploaded file info.
      const uploadedFile = result.data.file;
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
      setSelectedFile(null);
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
      const result = await apiFetch<unknown>(`/api/threads/${threadId}/messages`, {
        method: 'POST',
        json: { content },
      });
      if (!result.ok) {
        toastApiError(result, 'Failed to post message');
        return;
      }

      // Optimistic update of sent message - TODO: should we prefer pessimistic update?
      if (thread) {
        setThread({
          ...thread,
          messages: [...(thread.messages || []), { id: `temp-${Date.now()}`, authorUsername: currentUsername ?? 'User', content }],
        });
      }
      setMessageDraft('');
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
      const result = await apiFetch<unknown>(`/api/threads/${threadId}/files`, {
        method: 'DELETE',
        json: { fileId },
      });
      if (!result.ok) {
        toastApiError(result, 'Failed to delete file');
        return;
      }

      if (thread) {
        setThread({
          ...thread,
          files: (thread.files || []).filter((f) => f.id !== fileId),
        });
      }

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
      const result = await apiFetch<unknown>(`/api/threads/${threadId}`, {
        method: 'DELETE',
      });
      if (!result.ok) {
        toastApiError(result, 'Failed to close thread');
        return;
      }

      onRefresh?.();
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Runs after VoteBar persisted a vote: refetch, then reload the card for vote outcomes. */
  const handleVoteSubmitted = () => {
    refetchThread();
    onRefresh?.();
  };

  return {
    thread,
    isThreadLoading,
    isSubmitting,
    messageDraft,
    setMessageDraft,
    selectedFile,
    setSelectedFile,
    uploadFile,
    sendMessage,
    deleteFile,
    closeThread,
    handleVoteSubmitted,
    refetchThread,
  };
};
