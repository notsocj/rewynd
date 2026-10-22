// Scene "outro": the summary card, the last thing on the tape. A grid of
// the headline numbers, Claude's closing line, and a big "make your own"
// with the repo URL. STOP is pressed.
//
// This same component is the share card (`RewyndCard`, rendered as one
// still), so it has to look complete on its own as a screenshot.

import React from "react";
import { AGENT_LABELS, PERSONALITIES, TOOL_LABELS } from "../../../contract/recap";
import { Appear, ellipsis } from "../components/Appear";
import { hourLabel, num } from "../components/format";
import { useRecap } from "../recap/context";
import { Stage } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";

type Tile = { label: string; value: string };

const Grid: React.FC = () => {
  const { props, theme, font, s, name } = useRecap();
  const { stats, story } = props;
  const p = story.personality;

  const tiles: Tile[] = [
    { label: "HOURS", value: `${num(Math.floor(stats.totals.activeMinutes / 60))}h` },
    { label: "SESSIONS", value: num(stats.totals.sessions) },
    { label: "MAIN AI", value: stats.mainAgent ? AGENT_LABELS[stats.mainAgent] : "—" },
    { label: "PEAK HOUR", value: stats.time.busiestHour !== null ? hourLabel(stats.time.busiestHour) : "—" },
    { label: "TOP PROJECT", value: stats.projects[0] ? name(stats.projects[0].name) : "—" },
    { label: "TOP TOOL", value: stats.tools[0] ? TOOL_LABELS[stats.tools[0].category] ?? stats.tools[0].label : "—" },
    {
      label: "MADE WITH AI",
      value: stats.shipped && stats.shipped.commits > 0 ? `${Math.round(stats.shipped.aiShare * 100)}% of commits` : "—",
    },
    { label: "PERSONALITY", value: (p.title || PERSONALITIES[p.id]?.title || "—").replace(/^The /, "") },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: `${18 * s}px ${18 * s}px`,
      }}
    >
      {tiles.map((t, i) => (
        <Appear key={t.label} delay={10 + i * 3} distance={14}>
          <div
            style={{
              border: `${3 * s}px solid ${theme.faint}`,
              borderRadius: 16 * s,
              padding: `${18 * s}px ${22 * s}px`,
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 24 * s, fontWeight: 800, letterSpacing: "0.12em", color: theme.dim }}>{t.label}</div>
            <div
              style={{
                marginTop: 6 * s,
                fontSize: 52 * s,
                fontWeight: font.black,
                letterSpacing: "-0.03em",
                color: i === 7 ? theme.accent : theme.fg,
                textShadow: theme.osdShadow,
                fontVariantNumeric: "tabular-nums",
                ...ellipsis,
              }}
            >
              {t.value}
            </div>
          </div>
        </Appear>
      ))}
    </div>
  );
};

const Closing: React.FC = () => {
  const { props, theme, font, s, repoUrl, text } = useRecap();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 * s, textShadow: theme.osdShadow }}>
      <Appear delay={36}>
        <div style={{ fontSize: 60 * s, fontWeight: font.black, letterSpacing: "-0.03em", lineHeight: 1.08 }}>
          {text(props.story.closing)}
        </div>
      </Appear>
      <Appear delay={46}>
        <div style={{ fontSize: 38 * s, fontWeight: 700, color: theme.dim }}>
          Make your own tape → <span style={{ color: theme.fg }}>{repoUrl}</span>
        </div>
      </Appear>
    </div>
  );
};

export const Outro: React.FC = () => (
  <TapeCard active="stop">
    <Stage scene="outro" tapeSubtitle="THE RECAP" primaryShare={0.42} primary={<Closing />} secondary={<Grid />} />
  </TapeCard>
);
