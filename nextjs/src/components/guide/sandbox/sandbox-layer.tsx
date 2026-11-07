"use client";

/**
 * Full-screen layer that shows a tour's demo content above the page.
 * Spec Reference: 26-guided-tour.md - Demo Card
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface SandboxLayerProps {
  /** Accessible name of the layer. */
  label: string;
  /** Short text above the content, telling the user nothing here changes their real data. */
  notice: string;
  /** Extra classes of the content column, for example its maximum width. */
  className?: string;
  children: ReactNode;
}

/**
 * Covers the page with a tour's demo content. It is a plain element rather than a modal
 * dialog, whose focus trap would block the tour's tooltip, and it is rendered into the
 * document body so no ancestor (like the header's backdrop blur) contains it.
 *
 * @param props - The layer's name, the notice, the column classes and the demo content.
 * @returns The layer, rendered into the document body.
 */
export const SandboxLayer = ({ label, notice, className, children }: SandboxLayerProps) =>
  createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-sm"
    >
      <div className={cn("relative mx-auto flex w-full flex-col gap-4 px-4 py-8", className)}>
        <p className="text-center text-sm text-muted-foreground">{notice}</p>
        {children}
      </div>
    </div>,
    document.body
  );
