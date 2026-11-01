/**
 * Bingo confetti effect.
 *
 * Fires a shot of confetti from both bottom corners of the screen. Pieces rise,
 * slow down, then fall under gravity while fading out.
 *
 * The library is only downloaded at the first bingo and draws from a Web Worker,
 * so the effect adds nothing to page load and leaves the main thread free. It
 * adds its own click-through canvas to the page and removes it when finished.
 */

import type { CreateTypes, Options } from "canvas-confetti";

/** Palette of confetti colours. */
const COLORS = [
  "#f44336", // red
  "#e91e63", // pink
  "#9c27b0", // purple
  "#673ab7", // deep purple
  "#3f51b5", // indigo
  "#2196f3", // blue
  "#03a9f4", // light blue
  "#00bcd4", // cyan
  "#009688", // teal
  "#4caf50", // green
  "#8bc34a", // light green
  "#ffeb3b", // yellow
  "#ffc107", // amber
  "#ff9800", // orange
  "#ff5722", // deep orange
];

/** Number of pieces in each corner's shot. */
const PIECES_PER_CORNER = 90;

/** Launch angle from the horizontal, in degrees. */
const LAUNCH_ANGLE_DEGREES = 60;

/** Fraction of its speed a piece keeps on each frame. */
const VELOCITY_DECAY = 0.91;

/** Lifetime of a piece in frames; pieces fade out linearly over this time. */
const LIFETIME_FRAMES = 260;

/** How far up the screen a shot should reach, as a fraction of its height. */
const TARGET_HEIGHT_FRACTION = 0.75;

/** Shared instance, so simultaneous bingos draw on a single canvas. */
let confettiInstance: Promise<CreateTypes> | null = null;

/**
 * Loads the confetti library on first use and reuses it afterwards.
 *
 * @returns The shared confetti instance.
 */
const loadConfetti = (): Promise<CreateTypes> => {
  confettiInstance ??= import("canvas-confetti").then(({ default: confetti }) =>
    confetti.create(undefined, { useWorker: true, resize: true })
  );
  return confettiInstance;
};

/**
 * Computes the launch speed that carries a shot to the target height.
 *
 * Speed decays geometrically, so the total distance covered is
 * `speed / (1 - decay)`. Scaling with the viewport keeps the shot looking the
 * same on phones and on large monitors.
 *
 * @param viewportHeight - The viewport height in pixels.
 * @returns The start velocity for the shot.
 */
const launchVelocity = (viewportHeight: number): number => {
  const targetHeight = viewportHeight * TARGET_HEIGHT_FRACTION;
  const verticalShare = Math.sin((LAUNCH_ANGLE_DEGREES * Math.PI) / 180);
  return (targetHeight * (1 - VELOCITY_DECAY)) / verticalShare;
};

/**
 * Plays the bingo confetti effect, unless the user prefers reduced motion.
 *
 * The effect is decorative, so a failure to load it is ignored and retried at
 * the next bingo.
 *
 * @returns A promise that resolves once the shots have been started.
 */
export const fireBingoConfetti = async (): Promise<void> => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  try {
    const confetti = await loadConfetti();
    const shot: Options = {
      particleCount: PIECES_PER_CORNER,
      spread: 55,
      startVelocity: launchVelocity(window.innerHeight),
      decay: VELOCITY_DECAY,
      gravity: 1,
      ticks: LIFETIME_FRAMES,
      colors: COLORS,
    };

    void confetti({ ...shot, angle: LAUNCH_ANGLE_DEGREES, origin: { x: 0, y: 1 } });
    void confetti({ ...shot, angle: 180 - LAUNCH_ANGLE_DEGREES, origin: { x: 1, y: 1 } });
  } catch {
    confettiInstance = null;
  }
};
