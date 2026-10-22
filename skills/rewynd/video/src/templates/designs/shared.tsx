// Shared pieces for the hand-designed cards (hours, top tools, personality in
// each template, from the "rewynd card directions" mockups):
//
// - useCardData(): every number those cards show, worked out once from the
//   real stats (never invented: e.g. "vs September" only appears when
//   September was actually saved).
// - <Fill>: a flex column that fills the frame's free content area, so a card
//   can be laid out top-to-bottom like the mockups (with flex spacers).
// - <Ticker>: a number that counts up (integer or one decimal).
//
// The mockups were drawn at 540×960; the video is 1080×1920, so every size
// here is the mockup's ×2.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { AGENT_LABELS, PERSONALITIES, TOOL_LABELS } from "../../../../contract/recap";
import { countProgress } from "../../components/CountUp";
import { num } from "../../components/format";
import { useRecap } from "../../recap/context";
import { useContentRect } from "../frame";

const pad = (n: number) => String(n).padStart(2, "0");

export const useCardData = () => {
  const { props, text } = useRecap();
  const { stats, story } = props;
  const { totals, time, previous, tools, agents, period, coverage } = stats;
  const minutes = Math.max(0, totals.activeMinutes);
  const hours = Math.floor(minutes / 60);
  const vsPrev = previous && previous.activeMinutes > 0 ? Math.round(((minutes - previous.activeMinutes) / previous.activeMinutes) * 100) : null;
  const peak = time.busiestHour;
  const p = story.personality;
  const top5 = tools.slice(0, 5);
  const top5Sum = top5.reduce((a, t) => a + t.count, 0);
  return {
    minutes,
    hours,
    hoursOneDecimal: minutes / 60,
    fullDays: (minutes / 1440).toFixed(1),
    sessions: totals.sessions,
    toolCalls: totals.toolCalls,
    agentCount: agents.length,
    agentNames: agents.map((a) => AGENT_LABELS[a]),
    agentsText: agents.length ? agents.map((a) => AGENT_LABELS[a]).join(" and ") : "your AI",
    agentIds: agents.join(", ") || "your agents",
    lateNight: time.lateNightSessions,
    streak: time.longestStreakDays,
    // Saved days in the period with zero minutes (gaps aren't counted as days off).
    daysOff: time.heatmap.filter((d) => d.saved && d.minutes === 0).length,
    daysInPeriod: coverage.daysInPeriod,
    peak,
    peakClock: peak !== null ? `${pad(peak)}:00` : "--:--",
    peakAmPm: peak !== null ? `${pad(peak % 12 === 0 ? 12 : peak % 12)}:00 ${peak < 12 ? "AM" : "PM"}` : "--:--",
    vsPrev,
    prevShort: previous?.shortLabel ?? null,
    longestHours: stats.longestSession ? Math.floor(stats.longestSession.minutes / 60) : null,
    tools: top5.map((t) => ({ key: t.category, name: TOOL_LABELS[t.category] ?? t.label, count: t.count })),
    toolsMax: Math.max(1, ...top5.map((t) => t.count)),
    otherCalls: Math.max(0, totals.toolCalls - top5Sum),
    top5Sum,
    personalityTitle: p.title || PERSONALITIES[p.id]?.title || "The Coder",
    personalityLine: text(p.line),
    personalityId: p.id,
    hints: stats.personalityHints.slice(0, 3),
    periodShort: period.label.split(" ")[0],
    periodTape: period.tapeLabel,
    periodLabel: period.label,
    hoursCaption: story.captions.hours ? text(story.captions.hours) : null,
    aiShare: stats.shipped && stats.shipped.commits > 0 ? Math.round(stats.shipped.aiShare * 100) : null,
    fmt: num,
  };
};

/** Fills the frame's free content area as a flex column (vertical cards). */
export const Fill: React.FC<{ children: React.ReactNode; center?: boolean }> = ({ children, center }) => {
  const r = useContentRect();
  return (
    <div
      style={{
        position: "absolute",
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "stretch",
        textAlign: center ? "center" : "left",
      }}
    >
      {children}
    </div>
  );
};

/** Flexible empty space (the mockups' `flex-grow: 1` spacers). */
export const Grow: React.FC = () => <div style={{ flexGrow: 1 }} />;

/** A number that counts up from 0 to `value` (one decimal if `decimals`). */
export const Ticker: React.FC<{ value: number; delay: number; decimals?: 0 | 1; style?: React.CSSProperties }> = ({ value, delay, decimals = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = value * countProgress(frame, fps, delay);
  const shown = decimals ? v.toFixed(1) : num(Math.round(v));
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{shown}</span>;
};
