/**
 * Resolutions Page
 * Spec Reference: 02-user-profile-and-privacy.md, 03-personal-resolutions.md
 *
 * Server-first implementation:
 * - Auth and initial resolution reads are done on the server
 * - The client component only handles interactive mutations/dialog state
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getResolutionsByUser, type Resolution } from "@/lib/db";
import type { Subtask } from "@/lib/shared/types";
import ResolutionsPageClient from "./resolutions-page-client";

type ResolutionTypeValue = "base" | "compound" | "iterative";

interface UnifiedResolution {
  id: string;
  type: ResolutionTypeValue;
  ownerUserId: string;
  title: string;
  text: string;
  subtasks?: Subtask[];
  numberOfRepetition?: number;
  completedTimes?: number;
  createdAt: string;
  updatedAt: string;
}

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
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

async function ResolutionsContent() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

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
