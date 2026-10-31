/**
 * Resolutions Page
 * Spec Reference: 02-user-profile-and-privacy.md, 03-personal-resolutions.md
 *
 * Server-first implementation:
 * - Auth and initial resolution reads are done on the server
 * - The client component only handles interactive mutations/dialog state
 */

import { requireUser } from "@/lib/auth";
import { getResolutionsByUser, type Resolution } from "@/lib/db";
import type { ResolutionTypeValue, UnifiedResolution } from "@/lib/shared/types";
import { PageSpinner } from "@/components/page-spinner";
import { Suspense } from "react";
import ResolutionsPageClient from "./resolutions-page-client";

function toIsoDateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapResolution(resolution: Resolution): UnifiedResolution {
  return {
    id: resolution.id,
    type: resolution.resolutionType as ResolutionTypeValue,
    ownerUserId: resolution.ownerUserId,
    title: resolution.title,
    text: resolution.description ?? "",
    subtasks: resolution.subtasks ?? undefined,
    numberOfRepetition: resolution.numberOfRepetition ?? undefined,
    completedTimes: resolution.completedTimes,
    createdAt: toIsoDateString(resolution.createdAt),
    updatedAt: toIsoDateString(resolution.updatedAt),
  };
}

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
    <ResolutionsPageClient initialResolutions={resolutions.map(mapResolution)} />
  );
}

export default function ResolutionsPage() {
  return (
    <Suspense fallback={<ResolutionsLoadingFallback />}>
      <ResolutionsContent />
    </Suspense>
  );
}
