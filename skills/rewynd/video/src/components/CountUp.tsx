// The giant hero number that counts up from 0 (DESIGN.md §6).
//
// Two things keep it looking solid:
// 1. Digits use Inter's tabular (same-width) figures, so the number doesn't
//    wobble sideways while it counts. They also give it the even, "machine"
//    rhythm of a tape counter.
// 2. The size is calculated from how many characters the FINAL number has
//    (heroFontSize below), so "86" and "1,240" both fill the space they're
//    given instead of sharing one fixed size.

import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, EASE_OUT } from "./motion";
import type { FontSpec } from "../fonts";

// Thousands separators, always in US format so videos look the same everywhere.
export const formatNumber = (n: number) => n.toLocaleString("en-US");

// Font size that makes `value` fill `maxWidth` px, capped at `maxFontSize`.
// Digits take `digitEm` each, commas ~0.3em. We size from character counts
// instead of measuring in the browser, because a measurement taken before
// the font finishes loading would be wrong.
export const heroFontSize = (value: number, font: FontSpec, maxWidth: number, maxFontSize: number) => {
  const text = formatNumber(value);
  const digits = text.replace(/[^0-9]/g, "").length;
  const widthInEm = digits * font.digitEm + (text.length - digits) * 0.3;
  return Math.min(maxFontSize, maxWidth / widthInEm);
};

// How far (0 → 1) a count-up has progressed at a frame. Exported so other
// parts of a card (like the tape counter) can count in sync with the number.
export const countProgress = (frame: number, fps: number, delay: number) =>
  interpolate(frame, [delay, delay + fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    // Races at first, then slows into the final number.
    easing: Easing.bezier(0.12, 0.8, 0.3, 1),
  });

type Props = {
  value: number;
  font: FontSpec;
  fontSize: number;
  color: string;
  textShadow?: string;
  delay?: number;
  // Pixel fonts need room above/below their square glyphs.
  lineHeight?: number;
};

export const CountUp: React.FC<Props> = ({ value, font, fontSize, color, textShadow, delay = 0, lineHeight = 0.8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shown = formatNumber(Math.round(value * countProgress(frame, fps, delay)));

  // When the count lands: a small "punch" (1 → 1.04 → 1) from a bouncy
  // spring, so the final number feels like it hits.
  const land = spring({
    frame: frame - delay - fps,
    fps,
    config: { damping: 9, mass: 0.5, stiffness: 180 },
  });
  const punch = 1 + 0.04 * Math.sin(Math.PI * Math.min(land, 1));
  // ...and the signal "splits": red and cyan copies jump out sideways and
  // snap back over ~1/3 s, like a VHS picture catching up. Ease-out, so the
  // biggest split is right on the landing frame.
  const split = interpolate(frame, [delay + fps, delay + fps + 10], [1, 0], { ...CLAMP, easing: EASE_OUT });
  const chroma = split > 0 ? `${-10 * split}px 0 rgba(255,59,48,${0.85 * split}), ${10 * split}px 0 rgba(0,229,255,${0.85 * split})` : "";

  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: font.hero,
        fontWeight: font.black,
        fontSize,
        lineHeight,
        letterSpacing: font.heroTracking,
        fontVariantNumeric: "tabular-nums",
        color,
        // "none" can't be part of a shadow list (it would void the whole
        // value), so drop it before joining.
        textShadow: [chroma, textShadow].filter((x) => x && x !== "none").join(", ") || undefined,
        scale: punch,
        transformOrigin: "left bottom",
      }}
    >
      {shown}
    </span>
  );
};
