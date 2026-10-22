// The period drawn as a strip of tape: one bar per day (or per week for a
// whole year), height = minutes coded. A red playhead sweeps from start to
// end and the bars appear behind it, as if the tape is playing back.
//
// Days with no saved history (`saved: false`, e.g. days that haven't
// happened yet, or days rewynd never got to save) are drawn as short dashed
// stubs: blank tape. That's different from a saved day with 0 minutes,
// which is a thin solid sliver. Being honest about gaps matters: a blank
// stub says "no recording", not "you didn't code".

import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Stats } from "../../../contract/recap";
import { shortDay } from "../components/format";
import { useRecap } from "../recap/context";

type Props = {
  heatmap: Stats["time"]["heatmap"];
  busiestDay: string | null; // ISO date of the peak day, if any
  width: number;
  delay?: number;
};

type Bar = { minutes: number; saved: boolean; from: string; to: string };

// More than ~62 bars gets too thin to see, so long periods (a year) are
// grouped into weeks.
const toBars = (heatmap: Props["heatmap"]): Bar[] => {
  if (heatmap.length <= 62) {
    return heatmap.map((d) => ({ minutes: d.minutes, saved: d.saved, from: d.date, to: d.date }));
  }
  const bars: Bar[] = [];
  for (let i = 0; i < heatmap.length; i += 7) {
    const week = heatmap.slice(i, i + 7);
    bars.push({
      minutes: week.reduce((sum, d) => sum + d.minutes, 0),
      saved: week.some((d) => d.saved),
      from: week[0].date,
      to: week[week.length - 1].date,
    });
  }
  return bars;
};

export const TapeTimeline: React.FC<Props> = ({ heatmap, busiestDay, width, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font, s } = useRecap();

  const barArea = 120 * s;
  const bars = toBars(heatmap);
  if (bars.length === 0) return null;
  const gap = bars.length > 40 ? 3 : 6;
  const barWidth = Math.max(2, (width - gap * (bars.length - 1)) / bars.length);
  const step = barWidth + gap;
  const max = Math.max(...bars.map((b) => b.minutes), 1);
  const peakIndex = busiestDay ? bars.findIndex((b) => b.from <= busiestDay && busiestDay <= b.to) : -1;

  // Playhead position in "bars": 0 → all bars over 1.2s.
  const head = interpolate(frame, [delay, delay + 1.2 * fps], [0, bars.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <div style={{ position: "relative", width, fontFamily: font.family }}>
      <div style={{ position: "relative", height: barArea }}>
        {bars.map((bar, i) => {
          const x = i * step;
          if (!bar.saved) {
            // Blank tape stub.
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  bottom: 0,
                  width: barWidth,
                  height: 26 * s,
                  border: `2px dashed ${theme.dim}`,
                  borderBottom: "none",
                  opacity: 0.45,
                }}
              />
            );
          }
          // A bar grows over the 1.5 bars after the playhead passes it.
          const grow = interpolate(head, [i, i + 1.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                bottom: 0,
                width: barWidth,
                // Even a 0-minute day gets a 6px sliver so the strip has no holes.
                height: Math.max(6, (bar.minutes / max) * barArea) * grow,
                background: i === peakIndex ? theme.accent : theme.fg,
              }}
            />
          );
        })}

        {/* The playhead: a red line with a little square head on top. */}
        <div
          style={{
            position: "absolute",
            left: Math.min(head * step, width) - gap / 2 - 2,
            bottom: -10,
            width: 4,
            height: barArea + 34 * s,
            background: theme.rec,
          }}
        >
          <div style={{ position: "absolute", top: -10, left: -8, width: 20, height: 14, background: theme.rec }} />
        </div>
      </div>

      {/* Baseline: the edge of the tape. */}
      <div style={{ height: 4, background: theme.fg }} />

      {/* Labels under the strip: first day, last day, and the peak marker. */}
      <div
        style={{
          position: "relative",
          height: 50 * s,
          marginTop: 14 * s,
          fontSize: 30 * s,
          fontWeight: 800,
          letterSpacing: "0.06em",
          fontVariantNumeric: "tabular-nums",
          color: theme.dim,
          textShadow: theme.osdShadow,
        }}
      >
        <span style={{ position: "absolute", left: 0 }}>{shortDay(bars[0].from)}</span>
        <span style={{ position: "absolute", right: 0 }}>{shortDay(bars[bars.length - 1].to)}</span>
        {peakIndex >= 0 && busiestDay ? (
          <span
            style={{
              position: "absolute",
              // Centered under its bar, but kept inside the strip at the edges.
              left: Math.min(Math.max(peakIndex * step + barWidth / 2, 110 * s), width - 110 * s),
              translate: "-50% 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: theme.accent,
              background: theme.bg,
              padding: `0 ${8 * s}px`,
              whiteSpace: "nowrap",
              opacity: interpolate(head, [peakIndex + 0.5, peakIndex + 2], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <svg width={22 * s} height={18 * s} viewBox="0 0 22 18">
              <path d="M11 0 L22 18 L0 18 Z" fill={theme.accent} />
            </svg>
            {shortDay(busiestDay)}
          </span>
        ) : null}
      </div>
    </div>
  );
};
