// A segmented level meter, like the LED bars on a tape deck that bounce with
// the volume. Here the "volume" is how often a tool was used, relative to
// the most-used tool. It replaces plain bars with something that belongs
// on a tape machine.
//
// Motion:
// 1. Segments light up left to right, quickly, like a meter jumping.
// 2. Then the meter stays ALIVE: like an LED meter reading live audio it
//    flickers a segment or two below its level, a few times a second. It
//    never goes ABOVE the real level, so the bar can't overstate a number.
// 3. A "peak hold" segment sits at the real level the whole time, the way
//    deck meters remember the highest point.

import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, EASE_OUT } from "../components/motion";

type Props = {
  value: number; // 0..1, share of the top item
  // "segments": LED segments (tape). "solid": one continuous bar (terminal).
  // "blocks": chunky square pixels (arcade).
  variant?: "segments" | "solid" | "blocks";
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
  variant = "segments",
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
  const fillEnd = delay + 0.5 * fps;
  const filled = Math.round(interpolate(frame, [delay, fillEnd], [0, target], { ...CLAMP, easing: EASE_OUT }));
  // Live flicker after the fill: a new reading every 3 frames (10 per second,
  // like LEDs), dropping 0–2 segments below the level. Deterministic per
  // meter and frame, so every render looks the same.
  const tick = Math.floor(frame / 3);
  const seed = `${value}-${width}-${delay}`;
  const drop = frame > fillEnd && target > 2 ? Math.floor(random(`${seed}-${tick}`) * 2.4) : 0;
  const lit = Math.max(0, filled - drop);
  // The top 15% of the meter is the "hot" zone.
  const hotFrom = Math.round(segments * 0.85);

  if (variant === "solid") {
    // One bar: fills with the same ease-out, then breathes by a hair (never
    // past the real value) instead of flickering segment by segment.
    const fill = interpolate(frame, [delay, fillEnd], [0, value], { ...CLAMP, easing: EASE_OUT });
    const breathe = frame > fillEnd ? 1 - 0.015 * (1 + Math.sin(frame / 4)) : 1;
    return (
      <div style={{ width, height, background: offColor, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", background: onColor, scale: `${fill * breathe} 1`, transformOrigin: "left center" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: variant === "blocks" ? 8 : gap, width }}>
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          style={{
            width: segWidth,
            height,
            borderRadius: variant === "blocks" ? 0 : 3,
            // The peak-hold segment stays lit at the real level.
            background: i < lit || (frame > fillEnd && i === target - 1) ? (i >= hotFrom ? hotColor : onColor) : offColor,
          }}
        />
      ))}
    </div>
  );
};
