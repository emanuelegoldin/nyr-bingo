/**
 * Contract every guide follows, so any listed tour starts the same way.
 * Spec Reference: 26-guided-tour.md - Module Boundary
 */

import type { ComponentType } from "react";

/** Props of a tour component. Mounting it starts the tour; unmounting it stops it. */
export interface GuideTourProps {
  /** Called when the tour ends: finished, skipped or closed. */
  onEnd: () => void;
}

/** A guide listed on the Guides page. */
export interface GuideDefinition {
  /** Key of the guide's texts in the `Guide` namespace: `<id>.title` and `<id>.description`. */
  id: string;
  /** The tour, shown while it runs. */
  Tour: ComponentType<GuideTourProps>;
}
