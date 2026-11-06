/**
 * Teammates' reactions drawn over a stamped cell, each at its stored spot, tilt and size.
 * Spec Reference: 24-cell-reactions.md - Card Display
 */

import type { CellReactionMark } from "@/lib/shared/reactions";
import { ReactionIcon } from "./reaction-icon";

interface CellReactionsProps {
  reactions: CellReactionMark[];
}

/**
 * Renders the reactions over their parent cell, which must be positioned. Like the stamp, they
 * come before the title in the markup so the title paints over them.
 *
 * @param reactions - The reactions, drawn in order so later ones are on top.
 * @returns The reaction overlay, or nothing when there is no reaction.
 */
export const CellReactions = ({ reactions }: CellReactionsProps) => {
  if (reactions.length === 0) return null;

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      {reactions.map((mark, index) => (
        <ReactionIcon
          key={index}
          reaction={mark.reaction}
          className="absolute w-[24%] h-[24%] drop-shadow-sm"
          style={{
            left: `${mark.x}%`,
            top: `${mark.y}%`,
            // Center on the spot, then tilt and size around that center
            transform: `translate(-50%, -50%) rotate(${mark.rotation}deg) scale(${mark.scale / 100})`,
          }}
        />
      ))}
    </div>
  );
};
