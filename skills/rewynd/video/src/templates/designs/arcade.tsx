// ARCADE template, hand-designed cards (mockup "D · Arcade").
// Press Start 2P for everything game-like, Inter for the one human sentence.

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PersonalityId } from "../../../../contract/recap";
import { Appear } from "../../components/Appear";
import { CountUp, heroFontSize } from "../../components/CountUp";
import { CLAMP, SPRING } from "../../components/motion";
import { useRecap } from "../../recap/context";
import { TapeCard } from "../../tape/TapeCard";
import { TermList } from "../../tape/TermList";
import { useContentRect } from "../frame";
import { Fill, Grow, useCardData } from "./shared";

const pixel = (font: { ui: string }, size: number, color?: string): React.CSSProperties => ({
  fontFamily: font.ui,
  fontSize: size,
  lineHeight: 1.6,
  color,
});

// ---------------------------------------------------------------------------
// Hours: "STAGE CLEAR"
// ---------------------------------------------------------------------------

export const ArcadeHours: React.FC = () => {
  const { theme, font } = useRecap();
  const d = useCardData();
  const r = useContentRect();
  const size = heroFontSize(d.hours, font, (1080 - r.left - r.right) * 0.86, 400);
  const stats: [string, string, string?][] = [
    ["SESSIONS", d.fmt(d.sessions)],
    ["NIGHT RUNS", d.fmt(d.lateNight)],
  ];
  if (d.vsPrev !== null && d.prevShort) stats.push([`VS ${d.prevShort}`, `${d.vsPrev >= 0 ? "+" : ""}${d.vsPrev}%`, d.vsPrev >= 0 ? theme.add : theme.pink]);
  return (
    <TapeCard>
      <Fill center>
        <Grow />
        <Appear delay={4} distance={0}>
          <div style={pixel(font, 34, theme.pink)}>{d.periodShort.toUpperCase()} · STAGE CLEAR</div>
        </Appear>
        <Appear delay={10} distance={0}>
          <div style={{ ...pixel(font, 44, theme.cyan), marginTop: 56 }}>HOURS PLAYED</div>
        </Appear>
        <div style={{ marginTop: 48, lineHeight: 1 }}>
          <CountUp value={d.hours} font={font} fontSize={size} color={theme.accent} textShadow={`16px 16px 0 ${theme.pink}`} delay={14} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 52, marginTop: 88, textAlign: "center" }}>
          {stats.map(([label, value, color], i) => (
            <Appear key={label} delay={30 + i * 4} distance={0}>
              <div style={pixel(font, 28)}>
                <div style={{ color: theme.cyan }}>{label}</div>
                <div style={{ color: color ?? theme.fg }}>{value}</div>
              </div>
            </Appear>
          ))}
        </div>
        <Appear delay={44}>
          <div style={{ fontSize: 38, fontWeight: 500, marginTop: 68, color: "#D8D6F5", maxWidth: 880 }}>
            {d.hoursCaption ?? `That's ${d.fullDays} full days with ${d.agentsText}.`}
          </div>
        </Appear>
        <Grow />
      </Fill>
    </TapeCard>
  );
};

// ---------------------------------------------------------------------------
// Top tools: "HIGH SCORES"
// ---------------------------------------------------------------------------

export const ArcadeTools: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font } = useRecap();
  const d = useCardData();
  const pop = spring({ frame: frame - 4, fps, config: { damping: 12, mass: 0.5 } });
  return (
    <TapeCard>
      <Fill center>
        <div
          style={{
            ...pixel(font, 80, theme.accent),
            lineHeight: 1.2,
            marginTop: 40,
            textShadow: `10px 10px 0 ${theme.pink}`,
            scale: interpolate(pop, [0, 1], [0.6, 1]),
            opacity: interpolate(pop, [0, 0.3], [0, 1], CLAMP),
          }}
        >
          HIGH
          <br />
          SCORES
        </div>
        <Appear delay={12} distance={0}>
          <div style={{ ...pixel(font, 26, theme.dim), marginTop: 48 }}>TOP TOOLS · {d.periodShort.toUpperCase()}</div>
        </Appear>
        <div style={{ alignSelf: "stretch", marginTop: 116 }}>
          <TermList rows={d.tools.map((t) => ({ key: t.key, name: t.name, value: String(t.count).padStart(4, "0") }))} width={920} delay={18} />
        </div>
        <Grow />
        <Appear delay={46}>
          <div style={{ fontSize: 38, fontWeight: 500, color: "#D8D6F5" }}>
            {d.tools[0] ? `${d.tools[0].name} took the crown.` : "No high scores yet."}
          </div>
        </Appear>
      </Fill>
    </TapeCard>
  );
};

// ---------------------------------------------------------------------------
// Personality: "CHARACTER SELECT"
// ---------------------------------------------------------------------------

// 14×14 pixel icons, one per personality. "#" = accent, "+" = cyan, "." = empty.
const ICONS: Record<PersonalityId, string[]> = {
  "3am-shipper": ["..............", "....##........", "...##.....+...", "..###.........", ".####.........", ".####.......+.", ".####...+.....", ".#####........", ".#####........", ".########..##.", "..##########..", "...########...", "....######....", ".............."],
  rewriter: ["..........##..", ".........####.", "........#####.", ".......#####..", "......#####...", ".....#####....", "....#####.....", "...#####......", "..#####.......", "..####........", ".+###.........", ".++#..........", ".+............", ".............."],
  "polite-one": ["..............", "..............", "..###...###...", ".#####.#####..", ".###########..", ".###########..", ".###########..", "..#########...", "...#######....", "....#####.....", ".....###......", "......#.......", "..+.......+...", ".............."],
  speedrunner: ["........###...", ".......###....", "......###.....", ".....###......", "....###.......", "...#######....", "......####....", ".....####.....", "....###.......", "...###....+...", "..##..........", ".#........+...", "..............", ".............."],
  "bug-whisperer": ["..............", "...+......+...", "....+....+....", ".....####.....", "....######....", ".#.########.#.", "..##########..", "....######....", ".#.########.#.", "..##########..", "....######....", ".#..######..#.", ".....####.....", ".............."],
  architect: ["..............", "......##......", ".....####.....", "....######....", "...########...", "..##########..", ".############.", "..##########..", "..##++##++##..", "..##++##++##..", "..##########..", "..####..####..", "..####..####..", ".............."],
  juggler: ["..............", "......##......", ".....####.....", ".....####.....", "......##......", "..##......++..", ".####....++++.", ".####....++++.", "..##......++..", "..............", "...#......#...", "....#....#....", ".....####.....", ".............."],
  marathoner: [".....####.....", "......##......", "....######....", "...########...", "..###....###..", ".###......###.", ".##...+....##.", ".##...+....##.", ".##...+++..##.", ".###......###.", "..###....###..", "...########...", "....######....", ".............."],
  "weekend-warrior": ["......#.......", ".#....#....#..", "..#.......#...", ".....###......", "....#####.....", "...#######....", "##.#######.##.", "...#######....", "....#####.....", ".....###......", "..#.......#...", ".#....#....#..", "......#.......", ".............."],
};

// Short "stat bar" names for each personality score.
const STAT_NAMES: Record<PersonalityId, string> = {
  "3am-shipper": "NIGHT RUNS",
  rewriter: "REWRITES",
  "polite-one": "MANNERS",
  speedrunner: "SPEED",
  "bug-whisperer": "BUG HUNTS",
  architect: "PLANNING",
  juggler: "MULTITASK",
  marathoner: "STAMINA",
  "weekend-warrior": "WEEKENDS",
};

const PixelIcon: React.FC<{ id: PersonalityId; size: number }> = ({ id, size }) => {
  const { theme } = useRecap();
  const rows = ICONS[id] ?? ICONS["3am-shipper"];
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" shapeRendering="crispEdges" style={{ display: "block" }}>
      {rows.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c === "#" ? theme.accent : theme.cyan} />,
        ),
      )}
    </svg>
  );
};

export const ArcadePersonality: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font } = useRecap();
  const d = useCardData();
  // The portrait box drops in like a selected character; the icon bobs.
  const pick = spring({ frame: frame - 8, fps, config: SPRING.settle });
  const bob = Math.round(Math.sin(frame / 8) * 2) * 6; // whole-pixel steps, like sprite animation
  return (
    <TapeCard>
      <Fill center>
        <Appear delay={2} distance={0}>
          <div style={pixel(font, 40, theme.cyan)}>CHARACTER SELECT</div>
        </Appear>
        <div
          style={{
            marginTop: 64,
            width: 520,
            height: 520,
            boxSizing: "border-box",
            border: `12px solid ${theme.cyan}`,
            background: theme.panel,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `20px 20px 0 ${theme.pink}`,
            scale: interpolate(pick, [0, 1], [0.7, 1]),
            opacity: interpolate(pick, [0, 0.3], [0, 1], CLAMP),
          }}
        >
          <div style={{ translate: `0 ${bob}px` }}>
            <PixelIcon id={d.personalityId} size={392} />
          </div>
        </div>
        <Appear delay={24} distance={0}>
          <div style={{ ...pixel(font, 26, theme.pink), marginTop: 84 }}>YOUR CODER CLASS</div>
        </Appear>
        <Appear delay={30} distance={0}>
          <div style={{ ...pixel(font, 56, theme.accent), lineHeight: 1.4, marginTop: 28, maxWidth: 900 }}>{d.personalityTitle.toUpperCase()}</div>
        </Appear>
        <Appear delay={38}>
          <div style={{ fontSize: 38, fontWeight: 500, lineHeight: 1.45, color: "#D8D6F5", marginTop: 32, maxWidth: 820 }}>{d.personalityLine}</div>
        </Appear>
        {/* Stat bars: the top personality scores, 10 pixel blocks each. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 36, marginTop: 72, alignSelf: "stretch" }}>
          {d.hints.map((h, i) => {
            const filled = Math.round(h.score * 10);
            const shown = Math.round(interpolate(frame, [46 + i * 4, 58 + i * 4], [0, filled], CLAMP));
            return (
              <Appear key={h.id} delay={44 + i * 4} distance={0}>
                <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                  <span style={{ ...pixel(font, 24), width: 280, textAlign: "left", flexShrink: 0 }}>{STAT_NAMES[h.id] ?? h.id.toUpperCase()}</span>
                  <div aria-hidden="true" style={{ display: "flex", gap: 8, flexGrow: 1 }}>
                    {Array.from({ length: 10 }, (_, k) => (
                      <div key={k} style={{ flex: "1 1 0", height: 36, background: k < shown ? theme.accent : theme.faint }} />
                    ))}
                  </div>
                  <span style={{ ...pixel(font, 24), width: 90, textAlign: "right" }}>{Math.round(h.score * 100)}</span>
                </div>
              </Appear>
            );
          })}
        </div>
        <Grow />
      </Fill>
    </TapeCard>
  );
};
