import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteArchivedGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

/**
 * Delete button plus confirmation dialog. The dialog cannot be dismissed while the deletion
 * is in progress. The open state is controlled by the parent because a successful deletion
 * closes the dialog.
 *
 * @param props - The open state, its change handler, the confirm handler and the deleting flag.
 * @returns The button and its dialog.
 */
export function DeleteArchivedGameDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteArchivedGameDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!isDeleting) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this archived game?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the game from the archive for every player. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isDeleting}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
