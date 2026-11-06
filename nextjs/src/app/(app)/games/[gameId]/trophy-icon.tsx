/**
 * Trophy Icon — simple decorative trophy shown on the first-place podium card.
 * Spec Reference: 12-team-tabs.md - Leaderboard Tab
 */

interface TrophyIconProps {
  className?: string;
}

/**
 * Render a trophy (cup, handles, stem and base) in the current text colour.
 * @param className - Optional classes for size and colour.
 * @returns A decorative SVG element hidden from assistive technology.
 */
export const TrophyIcon = ({ className }: TrophyIconProps) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    {/* Handles */}
    <path
      d="M16 14H8v6c0 7 5 12 12 12M48 14h8v6c0 7-5 12-12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Cup */}
    <path d="M14 8h36v12c0 10-8 18-18 18S14 30 14 20z" />
    {/* Stem */}
    <rect x="28" y="37" width="8" height="10" />
    {/* Base */}
    <rect x="20" y="47" width="24" height="5" rx="1" />
    <rect x="16" y="52" width="32" height="6" rx="2" />
  </svg>
);
