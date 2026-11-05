import { Button } from "@ui/button";
import { useTranslations } from "next-intl";
import { useContext } from "react";
import { BingoCardContext } from "../BingoCardProvider";

// TODO: check whether it is necessary to lock edit buttons while update is in progress
// TODO: check whether it is necessary to hide edit buttons for non-owners

export function BingoCardEditButton() {
  const t = useTranslations("Dashboard");
  const { isEditMode, setEditMode } = useContext(BingoCardContext);

  return (
    <Button
      variant={isEditMode ? 'default' : 'outline'}
      size="sm"
      onClick={() => setEditMode(!isEditMode)}
    >
      {isEditMode ? t('done') : t('editCard')}
    </Button>
  );
}