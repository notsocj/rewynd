// Scene "heatmap": every day of the period as a calendar. Brighter = more
// minutes coded. Days with no saved history (`saved: false`) are drawn as
// hatched "no tape" cells, so a gap in the recording never looks like a
// day you didn't code.
//
// A month is a classic 7-column calendar (Mon–Sun). A longer period (a
// year) becomes a GitHub-style grid: one column per week, 7 rows.

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE_OUT } from "../components/motion";
import type { Stats } from "../../../contract/recap";
import { Appear } from "../components/Appear";
import { plural, weekday } from "../components/format";
import { Caption, Hero } from "../components/Hero";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";

type Day = Stats["time"]["heatmap"][number];

const Calendar: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, theme, font, s } = useRecap();
  const width = useSlotWidth();
  const days = props.stats.time.heatmap;
  if (days.length === 0) return null;

  const isMonth = days.length <= 31;
  const lead = weekday(days[0].date); // empty cells before day 1 so columns line up with weekdays
  const max = Math.max(...days.map((d) => d.minutes), 1);
  const peak = props.stats.time.busiestDay?.date;

  // Grid shape: month = 7 columns; year = one column per week.
  const cols = isMonth ? 7 : Math.ceil((days.length + lead) / 7);
  const gap = isMonth ? 12 * s : 3;
  const rowsNeeded = isMonth ? Math.ceil((days.length + lead) / 7) : 7;
  // Fit the width, and keep the grid under ~520px tall (6-week months too).
  const cell = Math.min(isMonth ? 112 * s : 40, (width - gap * (cols - 1)) / cols, (520 * s - gap * (rowsNeeded - 1)) / rowsNeeded);

  // Where day i sits in the grid.
  const place = (i: number) => {
    const slot = i + lead;
    return isMonth
      ? { col: slot % 7, row: Math.floor(slot / 7) }
      : { col: Math.floor(slot / 7), row: slot % 7 };
  };
  const rows = rowsNeeded;
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;

  // Cells pop in along the grid order, finishing in ~1 second.
  const stepFrames = 30 / Math.max(days.length, 1);

  const cellStyle = (d: Day, i: number): React.CSSProperties => {
    const shown = interpolate(frame, [10 + i * stepFrames, 16 + i * stepFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const base: React.CSSProperties = {
      position: "absolute",
      left: place(i).col * (cell + gap),
      top: place(i).row * (cell + gap),
      width: cell,
      height: cell,
      borderRadius: isMonth ? 10 * s : 2,
      opacity: shown,
      scale: interpolate(shown, [0, 1], [0.6, 1]),
    };
    if (!d.saved) {
      // "No tape": dashed outline with diagonal hatching.
      return {
        ...base,
        border: `${isMonth ? 3 : 1}px dashed ${theme.dim}`,
        backgroundImage: `repeating-linear-gradient(45deg, ${theme.faint} 0 3px, transparent 3px 10px)`,
      };
    }
    if (d.minutes <= 0) return { ...base, background: theme.faint };
    // Brightness from 35% to 100% of the accent, by minutes.
    return {
      ...base,
      background: theme.accent,
      opacity: shown * (0.35 + 0.65 * (d.minutes / max)),
      outline: d.date === peak ? `${4 * s}px solid ${theme.fg}` : undefined,
      outlineOffset: 3 * s,
    };
  };

  // Once the grid is in, a ring pulses out of the busiest day every second,
  // like a sonar ping: "this one".
  const peakIndex = days.findIndex((d) => d.date === peak);
  const settled = 16 + days.length * stepFrames;
  const ping = frame > settled ? ((frame - settled) % 30) / 30 : -1;

  return (
    <div style={{ fontFamily: font.family }}>
      {isMonth ? (
        // Weekday header row.
        <div style={{ position: "relative", height: 44 * s, width: gridW }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
            <span
              key={i}
              style={{ position: "absolute", left: i * (cell + gap), width: cell, textAlign: "center", fontSize: 30 * s, fontWeight: 800, color: theme.dim }}
            >
              {l}
            </span>
          ))}
        </div>
      ) : null}
      <div style={{ position: "relative", width: gridW, height: gridH }}>
        {peakIndex >= 0 && ping >= 0 ? (
          <div
            style={{
              position: "absolute",
              left: place(peakIndex).col * (cell + gap),
              top: place(peakIndex).row * (cell + gap),
              width: cell,
              height: cell,
              borderRadius: isMonth ? 10 * s : 2,
              border: `${4 * s}px solid ${theme.accent}`,
              // Grows and fades with an ease-out: fast burst, soft tail.
              scale: 1 + EASE_OUT(ping) * 0.6,
              opacity: 1 - EASE_OUT(ping),
            }}
          />
        ) : null}
        {days.map((d, i) => (
          <div key={d.date} style={cellStyle(d, i)}>
            {isMonth && cell > 60 ? (
              <span
                style={{
                  position: "absolute",
                  left: 10 * s,
                  top: 6 * s,
                  fontSize: 24 * s,
                  fontWeight: 800,
                  color: d.saved && d.minutes > 0 ? theme.bg : theme.dim,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {Number(d.date.slice(8))}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {/* Legend: what the colors and the hatching mean. */}
      <Appear delay={44}>
        <div style={{ display: "flex", gap: 36 * s, marginTop: 26 * s, fontSize: 28 * s, fontWeight: 700, color: theme.dim, textShadow: theme.osdShadow }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 * s }}>
            <span style={{ width: 26 * s, height: 26 * s, borderRadius: 5, background: theme.accent }} /> coded
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 * s }}>
            <span
              style={{
                width: 26 * s,
                height: 26 * s,
                borderRadius: 5,
                border: `2px dashed ${theme.dim}`,
                backgroundImage: `repeating-linear-gradient(45deg, ${theme.faint} 0 3px, transparent 3px 8px)`,
              }}
            />
            no tape (not saved)
          </span>
        </div>
      </Appear>
    </div>
  );
};

export const Heatmap: React.FC = () => {
  const { props, s } = useRecap();
  const { totals, time, coverage } = props.stats;
  const caption = props.story.captions.heatmap ?? `Longest streak: ${plural(time.longestStreakDays, "day")}.`;

  return (
    <TapeCard>
      <Stage
        scene="heatmap"
        tapeSubtitle="EVERY DAY"
        primaryShare={0.4}
        primary={
          <div style={{ display: "flex", flexDirection: "column", gap: 28 * s }}>
            <Hero value={totals.activeDays} unit={totals.activeDays === 1 ? "day" : "days"} maxSize={220} share={0.45} />
            <Caption delay={30}>{caption}</Caption>
            {coverage.gapDays > 0 ? (
              <Caption delay={36} size={36} dim>
                {plural(coverage.gapDays, "day")} with no saved history.
              </Caption>
            ) : null}
          </div>
        }
        secondary={<Calendar />}
      />
    </TapeCard>
  );
};
