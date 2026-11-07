"use client";

/**
 * Details of the demo card's target cell, shown by the guided tour; it calls no API.
 * Spec Reference: 26-guided-tour.md - Tour Steps
 */

import { STATE_CONFIG } from "@/components/cell/cell-state-style";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CellState } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { DEMO_TARGETS } from "./demo-data";

interface DemoCellDetailProps {
  /** Title of the resolution in the cell. */
  title: string;
  /** Whether the details are shown. They keep their place when hidden, so the tour can measure them. */
  open: boolean;
}

/**
 * The details of a pending demo cell: its title, state, type and source, and the
 * Mark Complete action, which the tour highlights.
 *
 * @param props - The resolution title and whether the details are shown.
 * @returns The details panel.
 */
export const DemoCellDetail = ({ title, open }: DemoCellDetailProps) => {
  const tl = useTranslations("Labels");
  const tc = useTranslations("Cell");
  const stateConfig = STATE_CONFIG[CellState.PENDING];

  return (
    <Card
      data-tour={DEMO_TARGETS.detail}
      aria-hidden={!open}
      className={cn("transition-opacity duration-300", open ? "opacity-100" : "invisible opacity-0")}
    >
      <CardHeader className="pb-3">
        <CardTitle className="font-headline text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", stateConfig.bg, stateConfig.text)}>
            {tl(`cellState.${CellState.PENDING}`)}
          </span>
          <Badge variant="outline">{tl("resolutionType.base")}</Badge>
          <Badge variant="secondary">{tl("cellSource.personal")}</Badge>
        </div>
        <div className="flex justify-end">
          <Button data-tour={DEMO_TARGETS.markComplete} tabIndex={-1}>
            <Check className="mr-2 h-4 w-4" /> {tc("markComplete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
