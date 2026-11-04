/**
 * Resolutions Page
 * Spec Reference: 02-user-profile-and-privacy.md, 03-personal-resolutions.md
 *
 * Server-first implementation:
 * - Auth and initial resolution reads are done on the server
 * - The client component only handles interactive mutations/dialog state
 */

import { requireUser } from "@/lib/auth";
import { getResolutionsByUser } from "@/lib/db";
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

  // Personal resolutions are user-owned, so we can fetch directly on the server.
  const resolutions = await getResolutionsByUser(currentUser.id);

  return (
    <ResolutionsPageClient initialResolutions={resolutions.map(toUnifiedResolution)} />
  );
}

export default function ResolutionsPage() {
  return (
    <Suspense fallback={<ResolutionsLoadingFallback />}>
      <ResolutionsContent />
    </Suspense>
  );
}
