// A segmented level meter, like the LED bars on a tape deck that bounce with
// the volume. Here the "volume" is how often a tool was used, relative to
// the most-used tool. It replaces plain bars with something that belongs
// on a tape machine.
//
// Motion: segments light up left to right, quickly, like a meter jumping.

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  value: number; // 0..1, share of the top item
  segments?: number;
  width: number;
  height?: number;
  onColor: string;
  // The last few segments use a "hot" color, like the red zone on a VU meter.
  hotColor: string;
  offColor: string;
  delay?: number;
};

export const LevelMeter: React.FC<Props> = ({
  value,
  segments = 24,
  width,
  height = 16,
  onColor,
  hotColor,
  offColor,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gap = 5;
  const segWidth = (width - gap * (segments - 1)) / segments;

  // How many segments end up lit, and how many are lit right now.
  // Anything above zero lights at least one segment; zero lights none.
  const target = value > 0 ? Math.max(1, Math.round(value * segments)) : 0;
  const lit = Math.round(
    interpolate(frame, [delay, delay + 0.5 * fps], [0, target], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  // The top 15% of the meter is the "hot" zone.
  const hotFrom = Math.round(segments * 0.85);

  return (
    <div style={{ display: "flex", gap, width }}>
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          style={{
            width: segWidth,
            height,
            borderRadius: 3,
            background: i < lit ? (i >= hotFrom ? hotColor : onColor) : offColor,
          }}
        />
      ))}
    </div>
  );
};
