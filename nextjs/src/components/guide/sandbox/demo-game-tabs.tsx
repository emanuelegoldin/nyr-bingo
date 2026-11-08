"use client";

/**
 * The game page's tabs, drawn for a tour to show where a feature is.
 * Spec Reference: 26-guided-tour.md - Other Tours
 */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";

/** The game page's tabs, in order (spec 12). */
const GAME_TABS = ["cards", "leaderboard", "threads", "progress"] as const;
export type GameTab = (typeof GAME_TABS)[number];

interface DemoGameTabsProps {
  /** The tab shown as selected. */
  active: GameTab;
  /** `data-tour` value of the selected tab. */
  marker: string;
}

/**
 * The game page's tab bar with one tab selected. It does not switch tabs.
 *
 * @param props - The selected tab and its tour marker.
 * @returns The tab bar.
 */
export const DemoGameTabs = ({ active, marker }: DemoGameTabsProps) => {
  const t = useTranslations("Games.detail.tabs");

  return (
    <Tabs value={active}>
      <TabsList className="max-w-full justify-start overflow-x-auto">
        {GAME_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} data-tour={tab === active ? marker : undefined}>
            {t(tab)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
