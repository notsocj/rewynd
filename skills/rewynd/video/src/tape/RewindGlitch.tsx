// The tape effects that wrap every scene in the video:
//
// IN  (first GLITCH_FRAMES ≈ 0.3s): the rewind glitch, as if the tape was
//     rewound and hit PLAY again. It
//     1. cuts the scene into horizontal strips and shoves each strip
//        sideways by a random amount (the classic VHS tear), settling back
//     2. flashes thin white noise lines across the picture
//     3. shows a big "◀◀" rewind symbol ("▶" on the very first scene: the
//        tape is just starting)
//
// OUT (last EXIT_FRAMES ≈ 0.27s): the tracking slips. The picture tears a
//     little more each frame and slides up, flickering, and runs straight
//     into the next scene's rewind glitch. The cut between two cards then
//     reads as ONE continuous tape motion instead of a hard jump.
//
// LAST scene only: instead of slipping, the tape STOPs and the picture
//     switches off like an old CRT TV: it collapses into a bright horizontal
//     line, then the line shrinks to nothing.
//
// In between, the scene renders untouched.
//
// "Random" uses Remotion's random(seed), which gives the same number for the
// same seed every time. That matters: the video must look identical every
// time it's rendered, and each frame may be rendered on a different thread.

import React, { createContext } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { CLAMP, EASE_IN_OUT, EXIT_FRAMES, GLITCH_FRAMES } from "../components/motion";
import { PlayIcon, RewindIcon } from "./Icons";

type Props = {
  children: React.ReactNode;
  // A different seed per scene so every glitch looks a little different.
  seed: string;
  // Total frames of this scene, so the exit knows when to start. Leave out
  // (Studio scene previews) to skip the exit.
  sceneFrames?: number;
  first?: boolean;
  last?: boolean;
  // Play the rewind glitch at the start (in the video only the first scene
  // does: the others arrive through a transition, see transitions/).
  enter?: boolean;
  // End with the tracking slip (Studio scene previews; the video uses real
  // transitions between scenes instead).
  slip?: boolean;
};

// Tells the card inside whether it's mid-rewind, so its transport bar can
// show REW pressed during the glitch instead of PLAY.
export const RewindingContext = createContext(false);

// How many horizontal strips the picture is cut into.
const STRIPS = 7;

/** The scene cut into strips, each pushed sideways by up to `amount` px. */
const Torn: React.FC<{ seed: string; frame: number; amount: number; lift?: number; children: React.ReactNode }> = ({
  seed,
  frame,
  amount,
  lift = 0,
  children,
}) => (
  <>
    {Array.from({ length: STRIPS }, (_, i) => {
      const top = (i / STRIPS) * 100;
      const bottom = 100 - ((i + 1) / STRIPS) * 100;
      const shift = (random(`${seed}-x-${i}-${frame}`) - 0.5) * amount;
      return (
        <AbsoluteFill
          key={i}
          style={{
            clipPath: `inset(${top}% 0 ${bottom}% 0)`,
            translate: `${shift}px ${(random(`${seed}-y-${frame}`) - 0.5) * amount * 0.15 + lift}px`,
            // Some strips flash brighter, like a bad tracking signal.
            filter: random(`${seed}-b-${i}-${frame}`) > 0.6 ? "brightness(1.6) contrast(1.2)" : undefined,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    })}
  </>
);

/** Thin white noise lines across the picture. */
const Noise: React.FC<{ seed: string; frame: number; opacity: number; count?: number }> = ({ seed, frame, opacity, count = 6 }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${random(`${seed}-n-${i}-${frame}`) * 100}%`,
          height: 4 + random(`${seed}-h-${i}-${frame}`) * 18,
          background: "rgba(255,255,255,0.85)",
          opacity,
        }}
      />
    ))}
  </>
);

export const RewindGlitch: React.FC<Props> = ({ children, seed, sceneFrames, first = false, last = false, enter = true, slip = true }) => {
  const frame = useCurrentFrame();

  // ---------------- IN: rewind glitch ----------------
  if (enter && frame < GLITCH_FRAMES) {
    // 1 at the start of the glitch, 0 at the end: the effect fades out.
    const strength = interpolate(frame, [0, GLITCH_FRAMES], [1, 0]);
    const Icon = first ? PlayIcon : RewindIcon;
    return (
      <RewindingContext.Provider value={!first}>
        <AbsoluteFill style={{ backgroundColor: "#000" }}>
          <Torn seed={seed} frame={frame} amount={260 * strength}>
            {children}
          </Torn>
          <Noise seed={seed} frame={frame} opacity={strength} />
          {/* The symbol, only for the first two-thirds of the glitch. */}
          {frame < GLITCH_FRAMES * 0.66 ? (
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <div style={{ filter: "drop-shadow(6px 6px 0 rgba(0,0,0,0.5))" }}>
                <Icon size={260} color="#FFFFFF" />
              </div>
            </AbsoluteFill>
          ) : null}
        </AbsoluteFill>
      </RewindingContext.Provider>
    );
  }

  // ---------------- OUT ----------------
  if (sceneFrames !== undefined && last) {
    // CRT switch-off over the last 12 frames.
    const OFF = 12;
    const q = interpolate(frame, [sceneFrames - OFF, sceneFrames - 1], [0, 1], CLAMP);
    if (q > 0) {
      // First 60%: the picture squashes into a line. Last 40%: the line shrinks.
      const squashY = interpolate(q, [0, 0.6], [1, 0.004], { ...CLAMP, easing: EASE_IN_OUT });
      const squashX = interpolate(q, [0.6, 1], [1, 0.02], { ...CLAMP, easing: EASE_IN_OUT });
      return (
        <AbsoluteFill style={{ backgroundColor: "#000" }}>
          <AbsoluteFill
            style={{
              scale: `${squashX} ${squashY}`,
              // The picture blows out to white as it collapses, like a CRT.
              filter: `brightness(${1 + q * 4}) contrast(${1 + q})`,
              opacity: interpolate(q, [0.85, 1], [1, 0], CLAMP),
            }}
          >
            {children}
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
  } else if (sceneFrames !== undefined && slip) {
    // Tracking slip over the last EXIT_FRAMES, growing toward the cut.
    const e = interpolate(frame, [sceneFrames - EXIT_FRAMES, sceneFrames - 1], [0, 1], { ...CLAMP, easing: EASE_IN_OUT });
    if (e > 0) {
      return (
        <AbsoluteFill style={{ backgroundColor: "#000" }}>
          {/* Same tear as the glitch, gentler, with the picture sliding up. */}
          <Torn seed={`${seed}-out`} frame={frame} amount={120 * e} lift={-60 * e}>
            {children}
          </Torn>
          <Noise seed={`${seed}-out`} frame={frame} opacity={e * 0.8} count={3} />
        </AbsoluteFill>
      );
    }
  }

  return <>{children}</>;
};
