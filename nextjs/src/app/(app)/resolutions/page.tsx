/**
 * Resolutions Page - the obsolete, read-only list of legacy personal resolutions
 * Spec Reference: 03-personal-resolutions.md - Legacy Personal Resolutions
 *
 * LEGACY-PERSONAL-RESOLUTIONS: remove this page (and its sidebar link) after 2027-05-08.
 */

import { requireUser } from "@/lib/auth";
import { getLegacyPersonalResolutions } from "@/lib/db";
import { toUnifiedResolution } from "@/lib/shared/resolution-form";
import { PageSpinner } from "@/components/page-spinner";
import { Suspense } from "react";
import ResolutionsPageClient from "./resolutions-page-client";

function ResolutionsLoadingFallback() {
  return (
    <PageSpinner />
  );
}

async function ResolutionsContent() {
  const currentUser = await requireUser();
  const resolutions = await getLegacyPersonalResolutions(currentUser.id);

  return (
    <ResolutionsPageClient resolutions={resolutions.map(toUnifiedResolution)} />
  );
}

export default function ResolutionsPage() {
  return (
    <Suspense fallback={<ResolutionsLoadingFallback />}>
      <ResolutionsContent />
    </Suspense>
  );
}
