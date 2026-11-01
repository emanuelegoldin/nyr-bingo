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
import { Loader2, type LucideIcon } from "lucide-react";
import { useState } from "react";

interface GameActionDialogProps {
  triggerLabel: string;
  triggerIcon: LucideIcon;
  triggerVariant: "outline" | "destructive";
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  isPending: boolean;
}

/**
 * Button plus confirmation dialog for an irreversible game action. The dialog cannot be
 * dismissed while the action is in progress.
 *
 * @param props - The labels, the action and whether it is running.
 * @returns The button and dialog.
 */
export function GameActionDialog({
  triggerLabel,
  triggerIcon: TriggerIcon,
  triggerVariant,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
}: GameActionDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!isPending) setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <TriggerIcon className="h-4 w-4 mr-2" /> {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
