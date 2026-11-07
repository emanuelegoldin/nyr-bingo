"use client";

/**
 * The request-proof tour's demo: the user's card, a teammate's card, and the dialogs drawn over them.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CellState } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buildDemoCells, type DemoCell } from "../sandbox/demo-cells";
import { DemoGrid } from "../sandbox/demo-grid";
import { DEMO_THREAD_RESOLUTION, DemoThread } from "../sandbox/demo-thread";
import { DemoVote } from "../sandbox/demo-vote";

/** `data-tour` values of the elements the tour highlights. */
export const PROOF_TARGETS = {
  cards: "demo-proof-cards",
  cell: "demo-proof-cell",
  request: "demo-request-proof",
} as const;

/** Position of the teammate's completed cell, the one the user asks proof for. */
const TARGET_POSITION = 2;

/** The user's card: two completed cells. */
const YOUR_CELLS = buildDemoCells(
  ["read", "cook", "guitar", "travel", "save", "call", "garden", "run"],
  { 0: CellState.COMPLETED, 6: CellState.COMPLETED }
);

/**
 * The teammate's card: one completed cell, under review once proof is requested.
 *
 * @param underReview - Whether proof has been requested.
 * @returns The cells, in position order.
 */
const teammateCells = (underReview: boolean): DemoCell[] => buildDemoCells(
  ["travel", "save", DEMO_THREAD_RESOLUTION, "call", "cook", "read", "garden", "guitar"],
  { [TARGET_POSITION]: underReview ? CellState.PENDING_REVIEW : CellState.COMPLETED }
);

/** One titled demo card. */
const TitledCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card>
    <CardHeader className="p-4">
      <CardTitle className="font-headline text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className="px-3 pb-4">{children}</CardContent>
  </Card>
);

/** A dialog drawn over the cards. It keeps its place when hidden, so the tour can measure it. */
const Overlay = ({ open, children }: { open: boolean; children: ReactNode }) => (
  <div
    aria-hidden={!open}
    className={cn("absolute inset-x-2 top-2 z-10 transition-opacity duration-300 sm:inset-x-8", open ? "opacity-100" : "invisible opacity-0")}
  >
    {children}
  </div>
);

export type ProofDemoStage = "cards" | "request" | "thread" | "review";

interface DemoProofCardsProps {
  /** What the demo shows: the cards, a dialog over them, or the cell under review. */
  stage: ProofDemoStage;
  /** Set while the tour waits for the user to open the teammate's cell. */
  onOpenCell?: () => void;
  /** Set while the tour waits for the user to confirm the request. */
  onRequest?: () => void;
}

/**
 * Both cards side by side (stacked on phones), the Request Proof dialog and the new thread.
 *
 * @param props - The demo stage and the handlers of the action steps.
 * @returns The cards and their dialogs.
 */
export const DemoProofCards = ({ stage, onOpenCell, onRequest }: DemoProofCardsProps) => {
  const t = useTranslations("Guide");
  const tp = useTranslations("Threads.requestProof");
  const resolutionTitle = t(`sandbox.cells.${DEMO_THREAD_RESOLUTION}`);
  // The hourglass appears once the thread is out of the way, so the user sees it land
  const underReview = stage === "review";

  return (
    <div className="relative">
      <div data-tour={PROOF_TARGETS.cards} className="grid gap-4 sm:grid-cols-2">
        <TitledCard title={t("requestProof.yourCard")}>
          <DemoGrid cells={YOUR_CELLS} targetPosition={-1} targetMarker="" />
        </TitledCard>
        <TitledCard title={t("requestProof.teammateCard")}>
          <DemoGrid
            cells={teammateCells(underReview)}
            targetPosition={TARGET_POSITION}
            targetMarker={PROOF_TARGETS.cell}
            onClickTarget={onOpenCell} />
        </TitledCard>
      </div>
      <Overlay open={stage === "request"}>
        <Card data-tour={PROOF_TARGETS.request} className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-lg">{tp("title")}</CardTitle>
            <CardDescription>{tp("description", { resolutionText: resolutionTitle })}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button disabled={!onRequest} className="disabled:opacity-100" onClick={onRequest}>
              <Eye className="mr-2 h-4 w-4" /> {tp("submit")}
            </Button>
          </CardContent>
        </Card>
      </Overlay>
      <Overlay open={stage === "thread"}>
        <DemoThread
          resolutionTitle={resolutionTitle}
          isOwner={false}
          files={[]}
          messages={[]}
          vote={<DemoVote accept={0} deny={0} myVote={null} canVote />} />
      </Overlay>
    </div>
  );
};
