// TAPE template, hand-designed cards (mockup "A · Tape").

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Appear } from "../../components/Appear";
import { CountUp, countProgress, heroFontSize } from "../../components/CountUp";
import { CLAMP, SPRING } from "../../components/motion";
import { useRecap } from "../../recap/context";
import { LevelMeter } from "../../tape/LevelMeter";
import { TapeCard } from "../../tape/TapeCard";
import { useContentRect } from "../frame";
import { Fill, Grow, useCardData } from "./shared";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** The cream paper label, slapped on slightly crooked. */
const Sticker: React.FC<{ title: string; meta: string; delay: number; tilt: number; wide?: boolean }> = ({ title, meta, delay, tilt, wide }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font } = useRecap();
  const drop = spring({ frame: frame - delay, fps, config: { damping: 13, mass: 0.7 } });
  return (
    <div
      style={{
        alignSelf: wide ? "stretch" : "flex-start",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 44,
        background: theme.label,
        color: theme.labelFg,
        borderRadius: 20,
        padding: "24px 40px",
        rotate: `${interpolate(drop, [0, 1], [tilt - 6, tilt])}deg`,
        translate: `0 ${interpolate(drop, [0, 1], [-50, 0])}px`,
        opacity: interpolate(drop, [0, 0.25], [0, 1], CLAMP),
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontFamily: font.hand, fontWeight: 700, fontSize: 84 }}>{title}</span>
      <span style={{ fontFamily: font.ui, fontSize: 44 }}>{meta}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------

export const TapeHours: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font } = useRecap();
  const d = useCardData();
  const r = useContentRect();
  const COUNT = 14;
  // The tape counter rolls up with the big number: hours:minutes:seconds:frames.
  const rolled = Math.round(d.minutes * countProgress(frame, fps, COUNT));
  const counter = `${pad(Math.floor(rolled / 60))}:${pad(rolled % 60)}:${pad(Math.floor(frame / fps) % 60)}:${pad(frame % fps)}`;
  const size = heroFontSize(d.hours, font, (1080 - r.left - r.right) * 0.74, 680);

  return (
    <TapeCard counter={counter}>
      <Fill>
        <Grow />
        <Appear delay={6}>
          <div style={{ fontFamily: font.ui, fontSize: 68, letterSpacing: 6 }}>HOURS WITH AI</div>
        </Appear>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <CountUp value={d.hours} font={font} fontSize={size} color={theme.fg} delay={COUNT} />
          <Appear delay={COUNT + 12} distance={0}>
            <div style={{ fontFamily: font.ui, fontSize: 80, color: theme.accent, paddingBottom: 28 }}>HRS</div>
          </Appear>
        </div>
        <Appear delay={30}>
          <div style={{ fontWeight: 600, fontSize: 60, marginTop: 56 }}>{d.hoursCaption ?? `That's ${d.fullDays} full days.`}</div>
        </Appear>
        <Appear delay={36}>
          <div style={{ fontSize: 38, color: theme.dim, marginTop: 12 }}>
            Across {d.fmt(d.sessions)} sessions with {d.agentsText}.
          </div>
        </Appear>
        <div style={{ marginTop: 72 }}>
          <Sticker title={d.periodLabel.replace(/ (\d\d)(\d\d)$/, " '$2")} meta={`SIDE A · ${d.daysInPeriod} DAYS`} delay={42} tilt={-2} />
        </div>
        <Grow />
      </Fill>
    </TapeCard>
  );
};

// ---------------------------------------------------------------------------
// Top tools
// ---------------------------------------------------------------------------

export const TapeTools: React.FC = () => {
  const { theme, font, tapeNumber } = useRecap();
  const d = useCardData();
  const r = useContentRect();
  const width = 1080 - r.left - r.right;
  return (
    <TapeCard transport={false}>
      <Fill>
        <Sticker title="Top tools" meta="SIDE A · TRACKLIST" delay={4} tilt={-1} wide />
        <div style={{ display: "flex", flexDirection: "column", gap: 68, marginTop: 112 }}>
          {d.tools.length === 0 ? (
            <div style={{ fontFamily: font.ui, fontSize: 48, color: theme.dim }}>NO TOOL CALLS ON THIS TAPE</div>
          ) : null}
          {d.tools.map((t, i) => (
            <Appear key={t.key} delay={16 + i * 5} distance={16}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 32 }}>
                <span style={{ fontFamily: font.ui, fontSize: 56, color: theme.dim }}>{pad(i + 1)}</span>
                <span style={{ fontWeight: 900, fontSize: 68, letterSpacing: -2, flexGrow: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                <span style={{ fontFamily: font.ui, fontSize: 60 }}>{d.fmt(t.count)}×</span>
              </div>
              <div style={{ marginTop: 20 }}>
                <LevelMeter value={t.count / d.toolsMax} width={width} height={32} segments={26} onColor={theme.accent} hotColor={theme.accent} offColor={theme.faint} delay={20 + i * 5} />
              </div>
            </Appear>
          ))}
        </div>
        <Grow />
        <Appear delay={46}>
          <div style={{ fontFamily: font.ui, fontSize: 48, color: theme.dim }}>
            {d.fmt(d.toolCalls)} TOOL CALLS · {d.agentNames.join(" + ").toUpperCase() || "YOUR AGENTS"} · CH {tapeNumber("tools")}
          </div>
        </Appear>
      </Fill>
    </TapeCard>
  );
};

// ---------------------------------------------------------------------------
// Personality: the cassette
// ---------------------------------------------------------------------------

const Reel: React.FC<{ spin: number }> = ({ spin }) => {
  const { theme } = useRecap();
  return (
    <div
      style={{
        width: 152,
        height: 152,
        borderRadius: "50%",
        border: `20px dotted ${theme.fg}`,
        boxSizing: "border-box",
        rotate: `${spin}deg`,
      }}
    />
  );
};

export const TapePersonality: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font } = useRecap();
  const d = useCardData();
  // The cassette slides in, then its reels turn (it's playing).
  const enter = spring({ frame: frame - 4, fps, config: SPRING.settle });
  const spin = Math.max(0, frame - 10) * 4;
  const stamp = spring({ frame: frame - 34, fps, config: SPRING.snappy });

  return (
    <TapeCard transport={false} osdRight={d.peakAmPm} counter={`00:${d.peakClock}:00`}>
      <Fill>
        <div
          aria-hidden="true"
          style={{
            marginTop: 40,
            alignSelf: "center",
            width: 880,
            height: 540,
            background: "#2A2A31",
            border: `6px solid ${theme.panelBorder}`,
            borderRadius: 40,
            padding: 36,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 28,
            rotate: `${interpolate(enter, [0, 1], [-9, -3])}deg`,
            translate: `0 ${interpolate(enter, [0, 1], [80, 0])}px`,
            opacity: interpolate(enter, [0, 0.3], [0, 1], CLAMP),
          }}
        >
          <div style={{ background: theme.accent, color: "#16161A", borderRadius: 16, padding: "18px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: font.hand, fontWeight: 700, fontSize: 72, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.personalityTitle}</span>
            <span style={{ fontFamily: font.ui, fontSize: 44, flexShrink: 0 }}>{d.periodTape}</span>
          </div>
          <div style={{ flexGrow: 1, background: "#16161A", borderRadius: 80, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 68px" }}>
            <Reel spin={spin} />
            <div style={{ width: 260, height: 20, background: theme.panelBorder, borderRadius: 10 }} />
            <Reel spin={spin} />
          </div>
        </div>
        <Grow />
        <Appear delay={28}>
          <div style={{ fontFamily: font.ui, fontSize: 60, letterSpacing: 6, color: theme.accent }}>MY CODER PERSONALITY</div>
        </Appear>
        <Appear delay={34} distance={0}>
          <div style={{ fontWeight: 900, fontSize: 152, lineHeight: 0.95, letterSpacing: -6, marginTop: 24, scale: interpolate(stamp, [0, 1], [1.12, 1]), transformOrigin: "left center" }}>
            {d.personalityTitle}
          </div>
        </Appear>
        <Appear delay={42}>
          <div style={{ fontSize: 44, lineHeight: 1.4, color: "#D6D2CA", marginTop: 40 }}>{d.personalityLine}</div>
        </Appear>
        <Appear delay={48}>
          <div style={{ display: "flex", gap: 56, marginTop: 56, fontFamily: font.ui, fontSize: 52 }}>
            <span>{d.fmt(d.lateNight)} NIGHT SESSIONS</span>
            <span style={{ color: theme.dim }}>PEAK {d.peakClock}</span>
          </div>
        </Appear>
        <Grow />
      </Fill>
    </TapeCard>
  );
};
