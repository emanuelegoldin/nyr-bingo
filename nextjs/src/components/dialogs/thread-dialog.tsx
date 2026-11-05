"use client";

import { useTranslations } from "next-intl";
import { useReviewThread } from "@/hooks/use-review-thread";
import { useTeamMembers } from "../team-members-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { CellDialog } from "./cell-dialog";
import { ThreadFiles } from "./thread-files";
import { ThreadMessages } from "./thread-messages";
import { VoteBar } from "./vote-bar";

interface CellThreadDialogProps {
  cell: {
    id: string,
    resolutionText: string,
    reviewThreadId: string
  }
  isOwner: boolean,
  currentUserId: string,
  isOpen: boolean,
  setIsOpen: (isOpen: boolean) => void,
  onRefresh?: () => void
}

export const CellThreadDialog = ({
  cell,
  isOwner,
  currentUserId,
  isOpen,
  setIsOpen,
  onRefresh
}: CellThreadDialogProps) => {
  const t = useTranslations("Threads");
  const currentUsername = useTeamMembers()[currentUserId];
  const {
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
  } = useReviewThread(cell.reviewThreadId, isOpen, { onRefresh, setIsOpen, currentUsername });

  return (
    <CellDialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={t("dialog.title")}
      description={t("dialog.description", { resolutionText: cell.resolutionText })}
    >
      <div className="space-y-4 py-4">
        {isThreadLoading ? (
          <p className="text-sm text-muted-foreground">{t("dialog.loading")}</p>
        ) : thread ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("dialog.status")}</p>
                <Badge variant="outline">{t(`dialog.statusValue.${thread.status}`)}</Badge>
              </div>
              {isOwner && thread.status === 'open' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={closeThread}
                  disabled={isSubmitting}
                >
                  {t("dialog.closeThread")}
                </Button>
              )}
            </div>

            <ThreadFiles
              files={thread.files}
              canManage={isOwner && thread.status === 'open'}
              isSubmitting={isSubmitting}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              onUpload={uploadFile}
              onDelete={deleteFile}
            />

            <VoteBar
              threadId={(cell.reviewThreadId || thread.id) as string}
              votes={thread.votes ?? []}
              currentUserId={currentUserId}
              threadOpen={thread.status === 'open'}
              canVote={!isOwner}
              onVoteSubmitted={handleVoteSubmitted}
              onVoteFailed={refetchThread}
            />

            <ThreadMessages
              messages={thread.messages}
              messageDraft={messageDraft}
              onDraftChange={setMessageDraft}
              isSubmitting={isSubmitting}
              threadOpen={thread.status === 'open'}
              onSend={sendMessage}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("dialog.unavailable")}</p>
        )}
      </div>
    </CellDialog>
  );
}
