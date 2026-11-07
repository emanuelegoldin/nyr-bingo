"use client";

/**
 * One entry of the Guides page: a title that expands to a description and a Play button.
 * Spec Reference: 26-guided-tour.md - Guides Page
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentType, useId, useState } from "react";
import type { GuideTourProps } from "./types";

interface GuideEntryProps {
  /** Title shown while the entry is collapsed. */
  title: string;
  /** Short description shown when the entry is expanded. */
  description: string;
  /** The tour that Play starts. */
  Tour: ComponentType<GuideTourProps>;
}

/**
 * A collapsible guide entry. Play mounts the tour, which runs until it calls `onEnd`; the
 * entry does not know which tour it starts.
 *
 * @param props - The guide's title, description and tour.
 * @returns The entry, and the tour while it runs.
 */
export const GuideEntry = ({ title, description, Tour }: GuideEntryProps) => {
  const t = useTranslations("Guide");
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <Card>
      <CardHeader className="p-0">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="flex w-full items-center justify-between gap-4 rounded-lg p-4 text-left font-headline text-lg font-semibold hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
        >
          <span>{title}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
        </button>
      </CardHeader>
      {isExpanded && (
        <CardContent id={contentId} className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button className="shrink-0" disabled={isPlaying} onClick={() => setIsPlaying(true)}>
            <Play className="mr-2 h-4 w-4" /> {t("play")}
          </Button>
        </CardContent>
      )}
      {isPlaying && <Tour onEnd={() => setIsPlaying(false)} />}
    </Card>
  );
};
