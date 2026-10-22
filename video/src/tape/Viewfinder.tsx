// A camcorder viewfinder drawn around whatever is inside it (the
// personality badge, the peak-hour number): four corner brackets, a battery
// icon, and the orange burned-in date stamp every home video had.
//
// It frames a moment as "caught on tape". It's a normal box in the layout
// (width × height), so it works in both video sizes.

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useRecap } from "../recap/context";

type Props = {
  width: number;
  height: number;
  stampLeft?: string; // e.g. "AM 3:07"
  stampRight?: string; // e.g. "OCT 21 2026"
  delay?: number;
  children: React.ReactNode;
};

export const Viewfinder: React.FC<Props> = ({ width, height, stampLeft, stampRight, delay = 0, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font, s } = useRecap();
  const arm = 90 * s; // length of each bracket arm
  const thick = 8 * s; // bracket line thickness

  // Brackets snap in from slightly outside, like the camera focusing.
  const focus = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.6 } });
  const out = interpolate(focus, [0, 1], [40, 0]);

  // One corner bracket: two bars forming an L, pushed `out` px outward.
  const corner = (key: string, top: boolean, left: boolean) => (
    <div
      key={key}
      style={{
        position: "absolute",
        [top ? "top" : "bottom"]: -out,
        [left ? "left" : "right"]: -out,
        width: arm,
        height: arm,
        borderTop: top ? `${thick}px solid ${theme.fg}` : undefined,
        borderBottom: top ? undefined : `${thick}px solid ${theme.fg}`,
        borderLeft: left ? `${thick}px solid ${theme.fg}` : undefined,
        borderRight: left ? undefined : `${thick}px solid ${theme.fg}`,
      }}
    />
  );

  // Stamp text: chunky, tabular digits, hard shadow, like burned-in video text.
  const stamp: React.CSSProperties = {
    position: "absolute",
    bottom: 34 * s,
    fontFamily: font.family,
    fontWeight: 800,
    fontSize: 46 * s,
    letterSpacing: "0.06em",
    fontVariantNumeric: "tabular-nums",
    color: theme.amber,
    textShadow: "3px 3px 0 rgba(0,0,0,0.55)",
    whiteSpace: "nowrap",
    opacity: interpolate(frame, [delay + 20, delay + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  };

  return (
    <div style={{ position: "relative", width, height }}>
      <div style={{ position: "absolute", inset: 0, opacity: interpolate(focus, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) }}>
        {corner("tl", true, true)}
        {corner("tr", true, false)}
        {corner("bl", false, true)}
        {corner("br", false, false)}

        {/* Battery, top-right inside the frame: 3 of 4 bars full. */}
        <div style={{ position: "absolute", right: 40 * s, top: 36 * s, display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 90 * s,
              height: 44 * s,
              border: `${5 * s}px solid ${theme.fg}`,
              borderRadius: 6,
              padding: 4 * s,
              display: "flex",
              gap: 4 * s,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, background: i < 3 ? theme.fg : "transparent" }} />
            ))}
          </div>
          <div style={{ width: 8 * s, height: 18 * s, background: theme.fg }} />
        </div>

        {stampLeft ? <div style={{ ...stamp, left: 36 * s }}>{stampLeft}</div> : null}
        {stampRight ? <div style={{ ...stamp, right: 36 * s }}>{stampRight}</div> : null}
      </div>

      {/* Whatever is being "filmed", centered in the frame. */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
};
