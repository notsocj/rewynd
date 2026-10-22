// ARCADE frame: an 8-bit cabinet screen.
//
//   1UP                         HI · SEP      ← pixel-font score bar
//   0086                           0071
//          ·  (twinkling pixel stars)  ·
//   …scene content, centered…
//           PRESS ◀◀ TO REWYND                ← blinking attract-mode line
//   MADE WITH REWYND            github.com/…
//
// Deep indigo, Press Start 2P, magenta drop shadows, cyan labels.

import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useIsStill } from "../../components/still";
import { useRecap } from "../../recap/context";
import { Camera } from "../../tape/Camera";
import { Footer } from "../../tape/Footer";
import { Scanlines } from "../../tape/Scanlines";
import { ContentRectContext, useSceneId } from "../frame";
import type { CardProps } from "../../tape/TapeCard";

const four = (n: number) => String(Math.max(0, Math.round(n))).padStart(4, "0").slice(-4);

export const ArcadeFrame: React.FC<CardProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font, wide, s, props } = useRecap();
  const scene = useSceneId();
  const { totals, previous, agents } = props.stats;
  const W = wide ? 1920 : 1080;
  const H = wide ? 1080 : 1920;

  // Score bar: your hours this period vs last period's "high score".
  const right = previous
    ? { label: `HI · ${previous.shortLabel}`, value: four(previous.activeMinutes / 60) }
    : { label: "CREDITS", value: String(agents.length).padStart(2, "0") };

  // "PRESS ◀◀ TO REWYND" blinks like an arcade attract screen (on 0.7s, off 0.3s).
  const blinkOn = useIsStill() || frame % fps < fps * 0.7;

  const bar: React.CSSProperties = { fontFamily: font.ui, fontSize: 30 * s, lineHeight: 1.8 };
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, color: theme.fg, fontFamily: font.family, overflow: "hidden" }}>
      {/* Pixel stars: same spots per scene, each twinkling at its own pace. */}
      {Array.from({ length: 7 }, (_, i) => {
        const r = (k: string) => random(`${scene}-star-${i}-${k}`);
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(frame / (10 + r("p") * 20) + r("o") * 6));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 40 + r("x") * (W - 80),
              top: 200 + r("y") * (H - 400),
              width: 12 * s,
              height: 12 * s,
              background: [theme.cyan, theme.pink, theme.amber][i % 3],
              opacity: twinkle,
            }}
          />
        );
      })}

      <div style={{ position: "absolute", left: 80, right: 80, top: wide ? 40 : 72, display: "flex", justifyContent: "space-between", ...bar }}>
        <div>
          <div style={{ color: theme.pink }}>1UP</div>
          <div>{four(totals.activeMinutes / 60)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: theme.cyan }}>{right.label}</div>
          <div>{right.value}</div>
        </div>
      </div>

      <ContentRectContext.Provider
        value={wide ? { left: 120, right: 120, top: 170, bottom: 170, align: "center" } : { left: 80, right: 80, top: 250, bottom: 270, align: "center" }}
      >
        <Camera>{children}</Camera>
      </ContentRectContext.Provider>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: wide ? 96 : 150,
          textAlign: "center",
          fontFamily: font.ui,
          fontSize: 32 * s,
          color: theme.accent,
          opacity: blinkOn ? 1 : 0,
        }}
      >
        PRESS ◀◀ TO REWYND
      </div>
      <Footer font="rewynd-inter, system-ui, sans-serif" size={26} weight={700} color={theme.dim} bottom={wide ? 40 : 64} />
      <Scanlines lineColor={theme.scanline} />
    </AbsoluteFill>
  );
};
