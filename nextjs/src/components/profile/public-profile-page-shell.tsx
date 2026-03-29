"use client";

import type { ReactNode } from "react";
import { useSetAppHeaderTitle } from "@/components/app-header-title";

interface PublicProfilePageShellProps {
  children: ReactNode;
}

/**
 * Client shell for client-only concerns (app header context).
 *
 * We keep data fetching and redirects in the server page and pass the server
 * content as children so only this tiny boundary hydrates on the client.
 */
export default function PublicProfilePageShell({
  children,
}: PublicProfilePageShellProps) {
  useSetAppHeaderTitle("Profile");

  return <>{children}</>;
}
