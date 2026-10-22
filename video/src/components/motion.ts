// The motion vocabulary of the whole video, in one place: curves, spring
// settings and shared timings. Scenes import these instead of inventing their
// own values, so every card moves with the same "hand".
//
// Rules behind the values (DESIGN.md §6):
// - Things ENTERING use a strong ease-out: they arrive fast and settle, so
//   the viewer sees the content right away instead of waiting for it.
// - Things MOVING while on screen use ease-in-out.
// - Constant motion (camera drift, rolling bands) is linear.
// - Springs keep bounce low: tape decks are mechanical, not rubbery.

import { Easing } from "remotion";

/** Strong ease-out for entrances: cubic-bezier(0.23, 1, 0.32, 1). */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** Strong ease-in-out for on-screen movement: cubic-bezier(0.77, 0, 0.175, 1). */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

/** interpolate() options that hold the first/last value outside the range. */
export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Springs. `snappy` for buttons and small parts, `settle` for bigger objects. */
export const SPRING = {
  snappy: { damping: 18, mass: 0.5, stiffness: 220 },
  settle: { damping: 15, mass: 0.7, stiffness: 140 },
} as const;

/** Length of the rewind glitch at the start of every scene (frames). */
export const GLITCH_FRAMES = 9;

/** Length of the tracking wobble at the end of every scene (frames). */
export const EXIT_FRAMES = 8;
