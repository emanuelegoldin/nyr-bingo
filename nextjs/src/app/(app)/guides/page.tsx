/**
 * Guides Page - the guided tours the user can start
 * Spec Reference: 26-guided-tour.md - Guides Page
 */

import { requireUser } from "@/lib/auth";
import GuidesPageClient from "./guides-page-client";

export default async function GuidesPage() {
  await requireUser();

  return <GuidesPageClient />;
}
