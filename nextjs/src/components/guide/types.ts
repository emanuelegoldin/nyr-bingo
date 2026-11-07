/**
 * Contract every guide follows, so any listed tour starts the same way.
 * Spec Reference: 26-guided-tour.md - Module Boundary
 */

import type { Messages } from "@/i18n/messages";
import type { ComponentType } from "react";

type GuideMessages = Messages["Guide"];

/** Keys of the `Guide` namespace that hold a guide's title and description. */
export type GuideId = {
  [Key in keyof GuideMessages]: GuideMessages[Key] extends { title: string; description: string } ? Key : never;
}[keyof GuideMessages];

/** Props of a tour component. Mounting it starts the tour; unmounting it stops it. */
export interface GuideTourProps {
  /** Called when the tour ends: finished, skipped or closed. */
  onEnd: () => void;
}

/** A guide listed on the Guides page. */
export interface GuideDefinition {
  /** Key of the guide's texts in the `Guide` namespace: `<id>.title` and `<id>.description`. */
  id: GuideId;
  /** The tour, shown while it runs. */
  Tour: ComponentType<GuideTourProps>;
}
