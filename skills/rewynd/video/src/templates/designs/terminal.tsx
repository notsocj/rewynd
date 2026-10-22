// TERMINAL template, hand-designed cards (mockup "B · Terminal").
// Everything sits inside the frame's window; text is JetBrains Mono at the
// mockup's 17px × 2 = 34px base size.

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PERSONALITIES } from "../../../../contract/recap";
import { Appear } from "../../components/Appear";
import { CountUp, heroFontSize } from "../../components/CountUp";
import { CLAMP, SPRING } from "../../components/motion";
import { useRecap } from "../../recap/context";
import { LevelMeter } from "../../tape/LevelMeter";
import { TapeCard } from "../../tape/TapeCard";
import { TypedPrompt } from "../../tape/Terminal";
import { snake, useContentRect } from "../frame";
import { Fill, Grow, useCardData } from "./shared";

/** One diff-style line: green "+ …" or red "- …" on a tinted strip. */
const Diff: React.FC<{ sign: "+" | "-"; children: React.ReactNode; delay: number }> = ({ sign, children, delay }) => {
  const { theme } = useRecap();
  const add = sign === "+";
  return (
    <Appear delay={delay} distance={12}>
      <div
        style={{
          background: add ? "rgba(63,185,80,0.14)" : "rgba(248,81,73,0.14)",
          color: add ? theme.add : theme.del,
          padding: "12px 24px",
          borderRadius: 12,
        }}
      >
        {sign} {children}
      </div>
    </Appear>
  );
};

const base: React.CSSProperties = { fontSize: 34, lineHeight: 1.6 };

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------

export const TerminalHours: React.FC = () => {
  const { theme, font, props } = useRecap();
  const d = useCardData();
  const r = useContentRect();
  const size = heroFontSize(d.hours, font, (1080 - r.left - r.right) * 0.72, 500);
  const period = props.stats.period;
  const flag = period.kind === "year" ? `--year ${period.from.slice(0, 4)}` : `--month ${period.from.slice(0, 7)}`;
  return (
    <TapeCard>
      <Fill>
        <div style={base}>
          <TypedPrompt command={`rewynd ${flag}`} fontSize={34} delay={4} textColor={theme.fg} />
          <Appear delay={16} distance={0}>
            <div style={{ color: theme.dim }}>scanning {d.agentIds} …</div>
          </Appear>
          <Appear delay={22} distance={0}>
            <div style={{ color: theme.accent }}>✓ {d.fmt(d.sessions)} sessions found</div>
          </Appear>
        </div>
        <Grow />
        <Appear delay={24} distance={0}>
          <div style={{ color: theme.dim, fontSize: 40 }}>hours_with_ai =</div>
        </Appear>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <CountUp value={d.hours} font={font} fontSize={size} color={theme.fg} delay={26} />
          <Appear delay={38} distance={0}>
            <span style={{ fontFamily: font.hero, fontWeight: 800, fontSize: size * 0.38, lineHeight: 1, color: theme.accent, paddingBottom: 12 }}>h</span>
          </Appear>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 68, fontSize: 38 }}>
          <Diff sign="+" delay={42}>
            {d.fullDays} full days of pairing
          </Diff>
          <Diff sign="+" delay={47}>
            {d.fmt(d.lateNight)} sessions after midnight
          </Diff>
          <Diff sign="-" delay={52}>
            {d.fmt(d.daysOff)} days off
          </Diff>
        </div>
        <Grow />
      </Fill>
    </TapeCard>
  );
};

// ---------------------------------------------------------------------------
// Top tools
// ---------------------------------------------------------------------------

export const TerminalTools: React.FC = () => {
  const { theme, font } = useRecap();
  const d = useCardData();
  const r = useContentRect();
  const width = 1080 - r.left - r.right;
  return (
    <TapeCard>
      <Fill>
        <div style={base}>
          <TypedPrompt command="rewynd tools --top 5" fontSize={34} delay={4} textColor={theme.fg} />
          <Appear delay={14} distance={0}>
            <div style={{ color: theme.dim }}># what your agents actually did</div>
          </Appear>
        </div>
        <Appear delay={18} distance={16}>
          <div style={{ fontFamily: font.hero, fontWeight: 800, fontSize: 104, lineHeight: 1.05, letterSpacing: -4, marginTop: 80 }}>top_tools</div>
        </Appear>
        <div style={{ display: "flex", flexDirection: "column", gap: 56, marginTop: 80 }}>
          {d.tools.map((t, i) => (
            <Appear key={t.key} delay={24 + i * 5} distance={12}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, fontSize: 48 }}>
                  <span style={{ color: theme.dim }}>{String(i + 1).padStart(2, "0")} </span>
                  {snake(t.name)}
                </span>
                <span style={{ fontSize: 40, color: theme.accent }}>{d.fmt(t.count)}</span>
              </div>
              <div style={{ marginTop: 16 }}>
                <LevelMeter variant="solid" value={t.count / d.toolsMax} width={width} height={28} onColor={theme.accent} hotColor={theme.accent} offColor={theme.faint} delay={28 + i * 5} />
              </div>
            </Appear>
          ))}
        </div>
        <Grow />
        <div style={{ fontSize: 36 }}>
          <Diff sign="+" delay={54}>
            {d.fmt(d.toolCalls)} tool calls this {d.periodLabel.match(/^\d{4}$/) ? "year" : "month"}
          </Diff>
        </div>
      </Fill>
    </TapeCard>
  );
};

// ---------------------------------------------------------------------------
// Personality: `whoami`
// ---------------------------------------------------------------------------

export const TerminalPersonality: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font } = useRecap();
  const d = useCardData();
  const name = snake(d.personalityTitle);
  // The answer to `whoami` prints like a stamp: it lands a little big.
  const land = spring({ frame: frame - 18, fps, config: SPRING.snappy });
  // One "# comment" per sentence of Claude's line.
  const sentences = d.personalityLine.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 3);
  return (
    <TapeCard>
      <Fill>
        <div style={base}>
          <TypedPrompt command="whoami" fontSize={34} delay={4} textColor={theme.fg} />
        </div>
        <Grow />
        <div
          style={{
            fontFamily: font.hero,
            fontWeight: 800,
            fontSize: 132,
            lineHeight: 1,
            letterSpacing: -6,
            color: theme.accent,
            overflowWrap: "anywhere",
            scale: interpolate(land, [0, 1], [1.1, 1]),
            opacity: interpolate(land, [0, 0.3], [0, 1], CLAMP),
            transformOrigin: "left center",
          }}
        >
          {/* Let long names break after an underscore, like the mockup. */}
          {name.split("_").map((part, i, all) => (
            <React.Fragment key={i}>
              {part}
              {i < all.length - 1 ? (
                <>
                  _<wbr />
                </>
              ) : null}
            </React.Fragment>
          ))}
        </div>
        <Appear delay={30}>
          <div style={{ color: theme.dim, fontSize: 38, lineHeight: 1.5, marginTop: 44 }}>
            {sentences.map((sen, i) => (
              <div key={i}># {sen.toLowerCase()}</div>
            ))}
          </div>
        </Appear>
        <div style={{ ...base, marginTop: 96 }}>
          <TypedPrompt command="rewynd personality --why" fontSize={34} delay={40} textColor={theme.fg} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
            {d.hints.map((h, i) => (
              <Appear key={h.id} delay={56 + i * 5} distance={0}>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: theme.accent }}>{h.score.toFixed(2)}</span>{" "}
                  <span style={{ color: theme.dim }}>{PERSONALITIES[h.id]?.title.replace(/^The /, "").toLowerCase()}</span>{" "}
                  {h.reason.split(";")[0]}
                </div>
              </Appear>
            ))}
          </div>
        </div>
        <Grow />
      </Fill>
    </TapeCard>
  );
};
