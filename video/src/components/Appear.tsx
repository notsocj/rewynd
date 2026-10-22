// Fades and slides its children up into place starting at `delay` frames.
// Almost every caption in the video arrives this way, so it lives in one
// place instead of being re-typed in every scene.
//
// Motion: a strong ease-out (EASE_OUT): most of the distance is covered in
// the first few frames, then it settles. Text is readable almost at once,
// and the arrival feels decisive instead of floaty.

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, EASE_OUT } from "./motion";

type Props = {
  delay: number;
  children: React.ReactNode;
  // How far it slides, px.
  distance?: number;
  style?: React.CSSProperties;
};

export const Appear: React.FC<Props> = ({ delay, children, distance = 28, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [delay, delay + 0.45 * fps], [0, 1], { ...CLAMP, easing: EASE_OUT });
  return (
    <div
      style={{
        // Opacity finishes a little before the slide, so the text is solid
        // while it's still settling.
        opacity: interpolate(t, [0, 0.6], [0, 1], CLAMP),
        translate: `0 ${(1 - t) * distance}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * A headline that arrives word by word (3 frames apart), each word with the
 * same ease-out rise as <Appear>. Used for the big statement lines, where a
 * whole-block fade felt flat. Words keep normal wrapping.
 */
export const Words: React.FC<{ text: string; delay: number; distance?: number }> = ({ text, delay, distance = 36 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {text.split(/(\s+)/).map((part, i) => {
        if (/^\s+$/.test(part)) return part;
        const start = delay + Math.floor(i / 2) * 3;
        const t = interpolate(frame, [start, start + 0.4 * fps], [0, 1], { ...CLAMP, easing: EASE_OUT });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: interpolate(t, [0, 0.6], [0, 1], CLAMP),
              translate: `0 ${(1 - t) * distance}px`,
            }}
          >
            {part}
          </span>
        );
      })}
    </>
  );
};

/** CSS that truncates a single line with "…" instead of overflowing. Put it
 *  on any text that holds a name we don't control (projects, repos). */
export const ellipsis: React.CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};
