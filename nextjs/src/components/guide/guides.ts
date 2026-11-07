/**
 * The guides listed on the Guides page, in display order.
 * Spec Reference: 26-guided-tour.md - Guides Page
 */

import { BingoTour } from "./bingo-card/bingo-tour";
import type { GuideDefinition } from "./types";

/** Every available guide. To add one, put its tour in its own folder and list it here. */
export const GUIDES: readonly GuideDefinition[] = [
  { id: "bingoCard", Tour: BingoTour },
];
