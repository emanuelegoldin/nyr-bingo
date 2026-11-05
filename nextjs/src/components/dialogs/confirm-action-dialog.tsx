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
import { useTranslations } from "next-intl";
import { useState } from "react";

interface ConfirmActionDialogBaseProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  isPending: boolean;
}

/** The dialog renders its own button and keeps its open state. */
interface TriggeredConfirmActionDialogProps extends ConfirmActionDialogBaseProps {
  triggerLabel: string;
  triggerIcon: LucideIcon;
  triggerVariant: "outline" | "destructive";
  open?: never;
  onOpenChange?: never;
}

/** The caller opens the dialog, for example from a menu item, and no button is rendered. */
interface ControlledConfirmActionDialogProps extends ConfirmActionDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel?: never;
  triggerIcon?: never;
  triggerVariant?: never;
}

type ConfirmActionDialogProps = TriggeredConfirmActionDialogProps | ControlledConfirmActionDialogProps;

/**
 * Button plus confirmation dialog for an irreversible action (ending, deleting or leaving a game,
 * leaving or deleting a team, deleting an archived game, promoting a leader). The dialog cannot be
 * dismissed while the action is in progress. When `open` and `onOpenChange` are given, the caller
 * controls the dialog and no button is rendered.
 *
 * @param props - The labels, the action, whether it is running and, optionally, the open state.
 * @returns The button and dialog.
 */
export function ConfirmActionDialog(props: ConfirmActionDialogProps) {
  const tc = useTranslations("Common");
  const { title, description, confirmLabel, onConfirm, isPending } = props;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = props.open !== undefined;
  const open = isControlled ? props.open : uncontrolledOpen;
  const setOpen = isControlled ? props.onOpenChange : setUncontrolledOpen;
  const TriggerIcon = props.triggerIcon;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!isPending) setOpen(nextOpen);
      }}
    >
      {TriggerIcon && (
        <AlertDialogTrigger asChild>
          <Button variant={props.triggerVariant} size="sm">
            <TriggerIcon className="h-4 w-4 mr-2" /> {props.triggerLabel}
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isPending}>
              {tc("cancel")}
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
