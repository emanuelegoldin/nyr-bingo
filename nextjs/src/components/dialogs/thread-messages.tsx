"use client";

import { ReviewMessageAndAuthor } from "@/lib/db/types";
import { useTranslations } from "next-intl";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

interface ThreadMessagesProps {
  messages: ReviewMessageAndAuthor[] | undefined;
  messageDraft: string;
  onDraftChange: (draft: string) => void;
  isSubmitting: boolean;
  /** Whether the thread is still open (messages can only be posted while open). */
  threadOpen: boolean;
  onSend: () => void;
}

/**
 * Messages section of the review thread dialog: the message list and the
 * composer (textarea and Send button).
 */
export const ThreadMessages = ({
  messages,
  messageDraft,
  onDraftChange,
  isSubmitting,
  threadOpen,
  onSend
}: ThreadMessagesProps) => {
  const t = useTranslations("Threads.messages");

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("title")}</p>
      {messages?.length ? (
        <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-2">
          {messages.map((m: ReviewMessageAndAuthor) => {
            return (
              <div key={m.id} className="text-sm">
                <p className="text-xs text-muted-foreground">{m.authorUsername ?? t("fallbackAuthor")}</p>
                <p>{m.content}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      )}

      <Textarea
        placeholder={t("placeholder")}
        value={messageDraft}
        onChange={(e) => onDraftChange(e.target.value)}
        disabled={isSubmitting || !threadOpen}
        rows={3}
      />
      <Button onClick={onSend} disabled={isSubmitting || !threadOpen}>
        {t("send")}
      </Button>
    </div>
  );
};
