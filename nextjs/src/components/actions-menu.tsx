/**
 * More actions menu: a "⋯" button that opens a menu of the less used actions of a page header.
 * Spec Reference: 16-games.md - Game Page
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

/** One item of the menu. */
export interface ActionsMenuItem {
  /** Unique within the menu. */
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Styles the item as destructive. */
  destructive?: boolean;
}

interface ActionsMenuProps {
  /** The items, in groups shown in order with a separator between them. Empty groups are skipped. */
  groups: ActionsMenuItem[][];
}

/**
 * Renders the More actions button and its menu. The caller owns the dialogs the items open.
 *
 * @param props - The item groups.
 * @returns The menu button and its menu.
 */
export function ActionsMenu({ groups }: ActionsMenuProps) {
  const tc = useTranslations("Common");
  const visibleGroups = groups.filter((group) => group.length > 0);

  return (
    // Not modal, so the page is usable again once a dialog opened from the menu closes
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={tc("moreActions")}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {visibleGroups.map((group, index) => (
          <Fragment key={group[0].key}>
            {index > 0 && <DropdownMenuSeparator />}
            {group.map(({ key, label, icon: Icon, onSelect, destructive }) => (
              <DropdownMenuItem
                key={key}
                onSelect={onSelect}
                className={destructive ? "text-destructive focus:text-destructive" : undefined}
              >
                <Icon className="h-4 w-4 mr-2" /> {label}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
