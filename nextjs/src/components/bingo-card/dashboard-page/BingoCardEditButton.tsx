import { Button } from "@ui/button";
import { useContext } from "react";
import { BingoCardContext } from "../BingoCardProvider";

// TODO: check whether it is necessary to lock edit buttons while update is in progress
// TODO: check whether it is necessary to hide edit buttons for non-owners

export function BingoCardEditButton() {
  const { isEditMode, setEditMode } = useContext(BingoCardContext);

  return (
    <Button
      variant={isEditMode ? 'default' : 'outline'}
      size="sm"
      onClick={() => setEditMode(!isEditMode)}
    >
      {isEditMode ? 'Done' : 'Edit Card'}
    </Button>
  );
}