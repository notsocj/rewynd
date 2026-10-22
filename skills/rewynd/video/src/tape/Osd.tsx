// The camcorder on-screen display (OSD) at the top of every TAPE card:
//
//   ● REC                         OCT 31 2026
//   ▶ PLAY   00:86:12:04
//
// Set in VT323, the blocky font of real camcorder/VCR displays. The REC dot
// blinks; the date is the last day of the recording; the counter under it is
// whatever the card passes in (the hours card rolls it up in sync with its big
// number), or a normal running timecode so the tape always feels like it's
// playing.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { stampDay } from "../components/format";
import { useRecap } from "../recap/context";

const pad = (n: number) => String(n).padStart(2, "0");

export const Osd: React.FC<{ counter?: string; right?: string }> = ({ counter, right }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font, wide, s, props } = useRecap();

  // REC dot blinks: on for 2/3 of a second, off for 1/3, like a camcorder.
  const recOn = frame % fps < fps * 0.66;
  // Fallback timecode: HH:MM:SS:FF, counting from the start of the card.
  const sec = Math.floor(frame / fps);
  const timecode = `00:${pad(Math.floor(sec / 60))}:${pad(sec % 60)}:${pad(frame % fps)}`;
  // Date stamp: the last day of the recording (today, for a month in progress).
  const last = props.stats.coverage.lastSavedDay ?? props.stats.period.to;
  const date = right ?? stampDay(last < props.stats.period.to ? last : props.stats.period.to).toUpperCase();

  const side = wide ? 80 : 80;
  return (
    <div
      style={{
        position: "absolute",
        left: side,
        right: side,
        top: wide ? 46 : 80,
        fontFamily: font.ui,
        color: theme.fg,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 60 * s, letterSpacing: 2 * s }}>
        <span>
          {/* Keep the dot's space when it's "off" so "REC" doesn't jump. */}
          <span style={{ color: theme.accent, opacity: recOn ? 1 : 0 }}>●</span> REC
        </span>
        <span>{date}</span>
      </div>
      <div style={{ fontSize: 48 * s, color: theme.dim, marginTop: 8 * s, fontVariantNumeric: "tabular-nums" }}>
        ▶ PLAY&nbsp;&nbsp;&nbsp;{counter ?? timecode}
      </div>
    </div>
  );
};
