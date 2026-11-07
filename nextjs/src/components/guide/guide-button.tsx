"use client";

/**
 * Help button of the application header that starts the bingo tour.
 * Spec Reference: 26-guided-tour.md - Trigger
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BingoTour } from "./bingo-card/bingo-tour";

interface GuideButtonProps {
  className?: string;
}

/**
 * A question-mark button that starts the bingo tour, and the tour while it runs.
 *
 * @param props.className - Extra classes for the button.
 * @returns The button, and the tour while it runs.
 */
export function GuideButton({ className }: GuideButtonProps) {
  const t = useTranslations("Guide");
  const [isTourOpen, setIsTourOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn("px-2", className)}
        aria-label={t("button")}
        title={t("button")}
        disabled={isTourOpen}
        onClick={() => setIsTourOpen(true)}
      >
        <CircleHelp className="h-4 w-4" />
      </Button>
      {isTourOpen && <BingoTour onEnd={() => setIsTourOpen(false)} />}
    </>
  );
}
