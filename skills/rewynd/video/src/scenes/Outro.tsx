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

  // RECEIPT: printed line items ("HOURS ........ 86H").
  if (theme.template === "receipt") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 * s, textAlign: "left" }}>
        {tiles.map((t, i) => (
          <Appear key={t.label} delay={10 + i * 3} distance={0}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 * s, fontSize: 32 * s }}>
              <span style={{ flexShrink: 0 }}>{t.label}</span>
              <span style={{ flexGrow: 1, borderBottom: `${4 * s}px dotted ${theme.fg}`, translate: `0 ${-8 * s}px`, minWidth: 16 * s }} />
              <span style={{ fontWeight: 700, ...ellipsis, maxWidth: "58%", color: i === 7 ? theme.stamp : theme.fg }}>{t.value.toUpperCase()}</span>
            </div>
          </Appear>
        ))}
      </div>
    );
  }

  // TERMINAL: a summary object printed as `key = value` lines.
  if (theme.template === "terminal") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 * s, fontSize: 36 * s, lineHeight: 1.5 }}>
        {tiles.map((t, i) => (
          <Appear key={t.label} delay={10 + i * 3} distance={0}>
            <div style={{ ...ellipsis }}>
              <span style={{ color: theme.dim }}>{t.label.toLowerCase().replace(/ /g, "_").padEnd(13, "\u00a0")}</span>
              <span style={{ color: theme.dim }}>= </span>
              <span style={{ color: i === 7 ? theme.accent : theme.fg }}>"{t.value}"</span>
            </div>
          </Appear>
        ))}
      </div>
    );
  }

  const arcade = theme.template === "arcade";
  return (
    <div
      style={{
        display: "grid",
        // minmax(0, 1fr): columns may shrink below their content, so a long
        // value truncates with "…" instead of pushing the grid wider.
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: `${18 * s}px ${18 * s}px`,
      }}
    >
      {tiles.map((t, i) => (
        <Appear key={t.label} delay={10 + i * 3} distance={14}>
          <div
            style={{
              border: `${(arcade ? 4 : 3) * s}px solid ${arcade ? theme.faint : theme.faint}`,
              borderRadius: arcade ? 0 : 16 * s,
              padding: `${18 * s}px ${22 * s}px`,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontFamily: font.ui,
                fontSize: (arcade ? 20 : theme.template === "tape" ? 34 : 24) * s,
                fontWeight: arcade || theme.template === "tape" ? 400 : 800,
                letterSpacing: arcade ? 0 : "0.08em",
                color: arcade ? theme.cyan : theme.dim,
                lineHeight: 1.4,
              }}
            >
              {t.label}
            </div>
            <div
              style={{
                marginTop: 6 * s,
                fontSize: 52 * s,
                fontWeight: font.black,
                letterSpacing: "-0.03em",
                color: i === 7 ? theme.accent : theme.fg,
                fontFamily: font.hero === font.ui ? font.family : undefined,
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
