// The camcorder: makes the picture feel FILMED instead of static.
//
// While a card holds (after its entrance, ~2–3 seconds), nothing used to move
// except the blinking cursor, so every card looked like a screenshot. The
// camera fixes that with two slow, continuous motions on the scene content:
//
// 1. A slow push-in (zoom 1.0 → 1.02 over the whole scene, linear), like
//    someone holding a camcorder and leaning in.
// 2. Handheld sway: a few pixels of drift and a fraction of a degree of tilt,
//    made from slow overlapping sine waves so it never visibly repeats.
//
// Only the CONTENT moves. The REC/counter, transport buttons, footer and
// scan lines stay locked, exactly like a real viewfinder's overlay. The
// amounts are small on purpose: the numbers must stay perfectly readable.
//
// The camera is switched on by the video (<Rewynd>) through CameraContext.
// The share card (<RewyndCard>) leaves it off, so the still image is never
// caught mid-tilt.

import React, { createContext, useContext } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

type CameraState = { on: boolean; sceneFrames: number; seed: number };

export const CameraContext = createContext<CameraState>({ on: false, sceneFrames: 1, seed: 0 });

/** Turn a scene id into a stable number, so each scene sways differently. */
export const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);

export const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { on, sceneFrames, seed } = useContext(CameraContext);
  if (!on) return <>{children}</>;

  const t = frame / fps; // seconds
  const p = seed * 0.37; // phase offset per scene
  // Push-in: linear across the scene (constant motion = linear).
  // 2%, not more: vertical cards keep content ~24px above the buttons.
  const zoom = 1 + 0.02 * Math.min(1, frame / sceneFrames);
  // Handheld: two sines per axis with unrelated periods (~3.1s and ~5.3s).
  const x = 4 * Math.sin(t * 2.03 + p) + 2 * Math.sin(t * 1.19 + p * 2);
  const y = 3 * Math.sin(t * 1.61 + p * 1.5) + 1.5 * Math.sin(t * 2.71 + p);
  const tilt = 0.18 * Math.sin(t * 1.33 + p);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        scale: zoom,
        translate: `${x}px ${y}px`,
        rotate: `${tilt}deg`,
      }}
    >
      {children}
    </div>
  );
};
