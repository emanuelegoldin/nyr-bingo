import { Button } from "@ui/button";
import { useContext } from "react";
import { BingoCardContext } from "../BingoCardProvider";

// TODO: check whether it is necessary to lock edit buttons while update is in progress
// TODO: check whether it is necessary to hide edit buttons for non-owners

export function BingoCardEditButton() {
    const context = useContext(BingoCardContext);
    if (!context) {
        throw new Error("BingoCardEditButton must be used within a BingoCardProvider");
    }


    return <Button
        variant={context.isEditMode ? 'default' : 'outline'}
        size="sm"
        onClick={() => context.actions.setEditMode(!context.isEditMode)}
    >
        {context.isEditMode ? 'Done' : 'Edit Card'}
    </Button>;
}