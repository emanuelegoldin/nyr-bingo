"use client";

/**
 * List of every available guide, shown on the Guides page.
 * Spec Reference: 26-guided-tour.md - Guides Page
 */

import { useTranslations } from "next-intl";
import { GuideEntry } from "./guide-entry";
import { GUIDES } from "./guides";

/**
 * Renders one collapsible entry per guide, with its translated title and description.
 *
 * @returns The list of guides.
 */
export const GuideList = () => {
  const t = useTranslations("Guide");

  return (
    <ul className="flex flex-col gap-4">
      {GUIDES.map((guide) => (
        <li key={guide.id}>
          <GuideEntry
            title={t(`${guide.id}.title`)}
            description={t(`${guide.id}.description`)}
            Tour={guide.Tour} />
        </li>
      ))}
    </ul>
  );
};
