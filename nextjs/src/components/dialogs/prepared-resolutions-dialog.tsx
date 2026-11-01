"use client";

/**
 * Prepared Resolutions Dialog
 * Spec Reference: 17-prepared-resolutions.md
 *
 * Lets a user browse the shared pool by category and copy entries into their
 * personal resolutions.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppContext } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getDictionaryForLocale } from "@/i18n/dictionary";
import { apiFetch } from "@/lib/api-client";
import {
  getResolutionTextKey,
  RESOLUTION_TYPE_BADGE_VARIANTS,
  RESOLUTION_TYPE_LABELS,
} from "@/lib/shared/resolution-type";
import { PreparedResolutionCategory } from "@/lib/shared/types";
import type { PreparedResolution, UnifiedResolution } from "@/lib/shared/types";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CATEGORIES = [
  PreparedResolutionCategory.SHORT,
  PreparedResolutionCategory.MEDIUM,
  PreparedResolutionCategory.LONG,
];

type DialogStrings = ReturnType<typeof getDictionaryForLocale>["PreparedResolutionsDialog"];

interface PreparedResolutionRowProps {
  resolution: PreparedResolution;
  isAdded: boolean;
  isAdding: boolean;
  disabled: boolean;
  onAdd: (resolution: PreparedResolution) => void;
  t: DialogStrings;
}

/** One pool entry with its add button. */
const PreparedResolutionRow = ({
  resolution,
  isAdded,
  isAdding,
  disabled,
  onAdd,
  t,
}: PreparedResolutionRowProps) => (
  <li className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/50">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{resolution.title}</span>
        <Badge variant={RESOLUTION_TYPE_BADGE_VARIANTS[resolution.resolutionType]} className="text-xs flex-shrink-0">
          {RESOLUTION_TYPE_LABELS[resolution.resolutionType]}
        </Badge>
      </div>
      {resolution.description && (
        <span className="text-xs text-muted-foreground block mt-0.5">{resolution.description}</span>
      )}
    </div>
    <Button
      size="sm"
      variant="outline"
      className="flex-shrink-0"
      disabled={isAdded || disabled}
      onClick={() => onAdd(resolution)}
    >
      {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
      {isAdded ? t.added : t.add}
    </Button>
  </li>
);

interface PreparedResolutionsDialogProps {
  /** The user's personal resolutions, used to mark entries they already have. */
  personalResolutions: UnifiedResolution[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  /** Called after an entry was copied, so the caller can reload its list. */
  onAdded: () => Promise<void>;
}

/**
 * Dialog listing the pool in one tab per category.
 * @param props.personalResolutions The user's personal resolutions
 * @param props.isOpen Whether the dialog is open
 * @param props.setIsOpen Called when the dialog opens or closes
 * @param props.onAdded Called after an entry was copied
 * @returns The dialog
 */
export const PreparedResolutionsDialog = ({
  personalResolutions,
  isOpen,
  setIsOpen,
  onAdded,
}: PreparedResolutionsDialogProps) => {
  const { language } = useAppContext();
  const t = getDictionaryForLocale(language).PreparedResolutionsDialog;
  const { toast } = useToast();

  const [pool, setPool] = useState<PreparedResolution[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // The pool only changes through migrations, so one successful load is enough.
  useEffect(() => {
    if (!isOpen || pool) return;

    let cancelled = false;
    apiFetch<{ resolutions: PreparedResolution[] }>("/api/resolutions/prepared").then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setPool(result.data.resolutions);
      } else {
        setLoadFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, pool]);

  const personalTexts = useMemo(
    () => new Set(personalResolutions.map((res) => getResolutionTextKey(res.title, res.text))),
    [personalResolutions]
  );

  /** Copy an entry into the user's personal resolutions. */
  const handleAdd = async (resolution: PreparedResolution) => {
    setAddingId(resolution.id);
    const result = await apiFetch<{ id: string }>(`/api/resolutions/prepared/${resolution.id}/add`, {
      method: "POST",
    });

    if (result.ok) {
      await onAdded();
      toast({ title: "Success", description: "Resolution added" });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to add resolution",
        variant: "destructive",
      });
    }
    setAddingId(null);
  };

  const renderBody = () => {
    if (!pool) {
      return loadFailed ? (
        <p className="text-sm text-center text-muted-foreground py-4">{t.loadError}</p>
      ) : (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <Tabs defaultValue={PreparedResolutionCategory.SHORT}>
        <TabsList className="grid w-full grid-cols-3">
          {CATEGORIES.map((category) => (
            <TabsTrigger key={category} value={category}>{t.categories[category]}</TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((category) => (
          <TabsContent key={category} value={category}>
            <p className="text-xs text-muted-foreground mb-2">{t.categoryHints[category]}</p>
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
              {pool.filter((resolution) => resolution.category === category).map((resolution) => (
                <PreparedResolutionRow
                  key={resolution.id}
                  resolution={resolution}
                  isAdded={personalTexts.has(getResolutionTextKey(resolution.title, resolution.description))}
                  isAdding={addingId === resolution.id}
                  disabled={addingId !== null}
                  onAdd={handleAdd}
                  t={t}
                />
              ))}
            </ul>
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        {renderBody()}
      </DialogContent>
    </Dialog>
  );
};
