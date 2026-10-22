// The camcorder on-screen display (OSD) across the top of every card:
// a blinking "● REC" on the left and a running tape counter on the right.
//
// The counter shows whatever the card passes in (e.g. the hours card counts
// up to "▶ 086:12:40" in sync with its big number). If a card passes
// nothing, it shows a normal running timecode, so the tape always feels
// like it's playing.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useRecap } from "../recap/context";
import { PlayIcon, RecIcon } from "./Icons";
import { frameFor } from "./layout";

// Two-digit padding: 7 → "07".
const pad = (n: number) => String(n).padStart(2, "0");

export const Osd: React.FC<{ counter?: string }> = ({ counter }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font, wide, s } = useRecap();
  const f = frameFor(wide);

  // REC dot blinks: on for 2/3 of a second, off for 1/3, like a camcorder.
  const recOn = frame % fps < fps * 0.66;

  // Fallback timecode: MM:SS:FF (minutes, seconds, frames).
  const seconds = Math.floor(frame / fps);
  const timecode = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}:${pad(frame % fps)}`;

  const text: React.CSSProperties = {
    fontFamily: font.family,
    fontWeight: 800,
    fontSize: 44 * s,
    letterSpacing: "0.04em",
    fontVariantNumeric: "tabular-nums",
    color: theme.fg,
    textShadow: theme.osdShadow,
    display: "flex",
    alignItems: "center",
    gap: 14 * s,
  };

  return (
    <div
      style={{
        position: "absolute",
        left: f.side,
        right: f.side,
        top: f.osdTop,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={text}>
        {/* Keep the dot's space when it's "off" so "REC" doesn't jump. */}
        <span style={{ opacity: recOn ? 1 : 0, display: "flex" }}>
          <RecIcon size={40 * s} color={theme.rec} />
        </span>
        REC
      </div>
      <div style={text}>
        <PlayIcon size={34 * s} color={theme.fg} />
        {counter ?? timecode}
      </div>
    </div>
  );
};
