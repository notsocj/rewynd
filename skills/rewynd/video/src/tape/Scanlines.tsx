// The "you're watching a tape" layer that sits on top of every card:
// 1. faint horizontal scan lines, like an old TV picture
// 2. a soft brighter band that slowly rolls down the screen (VHS tracking)
// 3. a gentle dark vignette at the edges, like a curved CRT
//
// It's deliberately subtle: the stats have to stay perfectly readable, and
// heavy scan lines turn into ugly moiré once social apps re-compress the video.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  lineColor: string;
};

export const Scanlines: React.FC<Props> = ({ lineColor }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  // The tracking band takes 5 seconds to roll from top to bottom, then loops.
  const bandY = ((frame / (5 * fps)) % 1) * (height + 400) - 200;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* 1. Scan lines: a 2px line every 6px. */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, ${lineColor} 0px, ${lineColor} 2px, transparent 2px, transparent 6px)`,
        }}
      />
      {/* 2. Rolling tracking band. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: bandY,
          height: 200,
          background:
            "linear-gradient(to bottom, transparent, rgba(255,255,255,0.045) 50%, transparent)",
        }}
      />
      {/* 3. Vignette. */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.28) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
