// The short rewind glitch at the start of every scene in the video, as if
// the tape was rewound and hit PLAY again.
//
// For the first ~9 frames (0.3s) it:
// 1. cuts the scene into horizontal strips and shoves each strip sideways by
//    a random amount (the classic VHS tear), settling back to normal
// 2. flashes thin white noise lines across the picture
// 3. shows a big "◀◀" rewind symbol
// After that it renders the scene untouched.
//
// "Random" here uses Remotion's random(seed), which gives the same number
// for the same seed every time. That matters: the video must look identical
// every time it's rendered, and each frame may be rendered on a different
// thread.

import React, { createContext } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { RewindIcon } from "./Icons";

type Props = {
  children: React.ReactNode;
  durationInFrames?: number;
  // A different seed per scene so every glitch looks a little different.
  seed: string;
};

// Tells the card inside whether it's mid-rewind, so its transport bar can
// show REW pressed during the glitch instead of PLAY.
export const RewindingContext = createContext(false);

// How many horizontal strips the picture is cut into during the glitch.
const STRIPS = 7;

export const RewindGlitch: React.FC<Props> = ({ children, durationInFrames = 9, seed }) => {
  const frame = useCurrentFrame();

  if (frame >= durationInFrames) {
    return <>{children}</>;
  }

  // 1 at the start of the glitch, 0 at the end: the effect fades out.
  const strength = interpolate(frame, [0, durationInFrames], [1, 0]);

  return (
    <RewindingContext.Provider value={true}>
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        {/* 1. Torn strips. Each strip is a full copy of the scene, clipped to
            its own band and pushed sideways. */}
        {Array.from({ length: STRIPS }, (_, i) => {
          const top = (i / STRIPS) * 100;
          const bottom = 100 - ((i + 1) / STRIPS) * 100;
          const shift = (random(`${seed}-x-${i}-${frame}`) - 0.5) * 260 * strength;
          return (
            <AbsoluteFill
              key={i}
              style={{
                clipPath: `inset(${top}% 0 ${bottom}% 0)`,
                translate: `${shift}px ${(random(`${seed}-y-${frame}`) - 0.5) * 40 * strength}px`,
                // Some strips flash brighter, like a bad tracking signal.
                filter: random(`${seed}-b-${i}-${frame}`) > 0.6 ? "brightness(1.6) contrast(1.2)" : undefined,
              }}
            >
              {children}
            </AbsoluteFill>
          );
        })}

        {/* 2. Noise lines. */}
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${random(`${seed}-n-${i}-${frame}`) * 100}%`,
              height: 4 + random(`${seed}-h-${i}-${frame}`) * 18,
              background: "rgba(255,255,255,0.85)",
              opacity: strength,
            }}
          />
        ))}

        {/* 3. Rewind symbol, only for the first two-thirds of the glitch. */}
        {frame < durationInFrames * 0.66 ? (
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ filter: "drop-shadow(6px 6px 0 rgba(0,0,0,0.5))" }}>
              <RewindIcon size={260} color="#FFFFFF" />
            </div>
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
    </RewindingContext.Provider>
  );
};
