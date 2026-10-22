// Fades and slides its children up into place starting at `delay` frames.
// Almost every caption in the video arrives this way, so it lives in one
// place instead of being re-typed in every scene.

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  delay: number;
  children: React.ReactNode;
  // How far it slides, px.
  distance?: number;
  style?: React.CSSProperties;
};

export const Appear: React.FC<Props> = ({ delay, children, distance = 24, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  return (
    <div
      style={{
        opacity: interpolate(frame, [delay, delay + 0.4 * fps], [0, 1], clamp),
        translate: `0 ${interpolate(frame, [delay, delay + 0.5 * fps], [distance, 0], clamp)}px`,
        ...style,
      }}
    >
      {children}
    </div>
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
