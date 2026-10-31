import type { EditOption } from "@/hooks/use-edit-cell-options";
import { RESOLUTION_TYPE_LABELS } from "@/lib/shared/resolution-type";
import { CellSourceType, ResolutionType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

interface EditOptionRowProps {
  option: EditOption,
  usernames: Record<string, string>,
  isSubmitting: boolean,
  onSelect: (option: EditOption) => void
}

/**
 * One selectable replacement resolution in the edit cell dialog: its label,
 * its type badge (hidden for base resolutions) and who provided it.
 *
 * @param option - The replacement resolution shown by the row.
 * @param usernames - Team member usernames by user id, used for member-provided options.
 * @param isSubmitting - Whether an edit is in flight; disables the row.
 * @param onSelect - Called with the option when the row is clicked.
 * @returns The option row button.
 */
export const EditOptionRow = ({
  option: opt,
  usernames,
  isSubmitting,
  onSelect
}: EditOptionRowProps) => {
  const isMemberProvided = opt.sourceType === CellSourceType.MEMBER_PROVIDED;
  const providerName = opt.sourceUserId ? (usernames[opt.sourceUserId] ?? 'Team member') : null;
  const typeLabel = opt.resolutionType === ResolutionType.BASE ? null : RESOLUTION_TYPE_LABELS[opt.resolutionType];
  return (
    <button
      onClick={() => onSelect(opt)}
      disabled={isSubmitting}
      className={cn(
        'w-full text-left rounded-md border px-3 py-2 text-sm hover:bg-secondary/50 transition-colors',
        isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium leading-snug">{opt.label}</p>
        <div className="flex items-center gap-1 shrink-0">
          {typeLabel && (
            <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
          )}
          <Badge variant="outline" className="shrink-0">
            {isMemberProvided ? (providerName ?? 'Member') : 'Personal'}
          </Badge>
        </div>
      </div>
    </button>
  );
};
