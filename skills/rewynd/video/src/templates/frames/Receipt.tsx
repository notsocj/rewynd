// RECEIPT frame: a till receipt on a bright color field.
//
//   (accent color field)
//     ┌──────────────────────┐   ← slightly rotated paper
//     │       R E W Y N D     │
//     │ AI CODING CO. · OCT…  │
//     │ ORDER #312 · 31/10/26 │
//     │ - - - - - - - - - - - │
//     │ …scene content…       │
//     └/\/\/\/\/\/\/\/\/\/\/\┘   ← torn zigzag edge
//   MADE WITH REWYND      github.com/…
//
// Everything on the paper is Space Mono in black ink. The paper tilts a
// different way on each scene, like receipts tossed on a table.

import React from "react";
import { AbsoluteFill } from "remotion";
import { num } from "../../components/format";
import { useRecap } from "../../recap/context";
import { Camera, seedOf } from "../../tape/Camera";
import { Footer } from "../../tape/Footer";
import { ContentRectContext, useSceneId } from "../frame";
import type { CardProps } from "../../tape/TapeCard";

/** The torn bottom edge: a zigzag strip in the paper color. */
export const Zigzag: React.FC<{ width: number; color: string; tooth?: number }> = ({ width, color, tooth = 20 }) => {
  const n = Math.ceil(width / tooth);
  const pts = ["0,0", `${width},0`];
  for (let i = n; i >= 0; i--) pts.push(`${Math.min(width, i * tooth)},${i % 2 ? 0 : tooth * 1.4}`);
  return (
    <svg width={width} height={tooth * 1.4} viewBox={`0 0 ${width} ${tooth * 1.4}`} style={{ display: "block" }}>
      <polygon fill={color} points={pts.join(" ")} />
    </svg>
  );
};

/** A dashed rule across the paper. */
export const Rule: React.FC<{ margin?: number }> = ({ margin = 36 }) => {
  const { theme, s } = useRecap();
  return <div style={{ borderTop: `${4 * s}px dashed ${theme.fg}`, margin: `${margin * s}px 0` }} />;
};

export const ReceiptFrame: React.FC<CardProps> = ({ children }) => {
  const { theme, font, wide, s, props } = useRecap();
  const scene = useSceneId();
  const { period, totals } = props.stats;
  // Tilt alternates by scene: -1.5°, +1.5°, -1°…
  const tilt = [-1.5, 1.5, -1, 1][seedOf(scene) % 4];
  const [d, m, y] = [period.to.slice(8, 10), period.to.slice(5, 7), period.to.slice(2, 4)];

  // Paper geometry (px). Content lives inside the paper, under the header.
  const paperW = wide ? 1400 : 840;
  const paperLeft = (wide ? 1920 : 1080) / 2 - paperW / 2;
  const paperTop = wide ? 50 : 96;
  const paperBottom = wide ? 150 : 230; // distance from card bottom to the torn edge
  const padX = wide ? 70 : 60;
  const header = wide ? 150 : 300; // height of the REWYND header block incl. rule

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, color: theme.fg, fontFamily: font.family, overflow: "hidden" }}>
      <Camera>
        <div style={{ position: "absolute", inset: 0, rotate: `${tilt}deg` }}>
          <div
            style={{
              position: "absolute",
              left: paperLeft,
              width: paperW,
              top: paperTop,
              bottom: paperBottom,
              background: theme.paperBg,
              padding: `${68 * s}px ${padX}px 0`,
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 68 * s, letterSpacing: 16 * s, lineHeight: 1.2 }}>REWYND</div>
            <div style={{ fontSize: 26 * s, marginTop: 6 * s }}>AI CODING CO. · {period.label.toUpperCase()}</div>
            {!wide ? (
              <div style={{ fontSize: 26 * s, color: theme.dim }}>
                ORDER #{num(totals.sessions)} · {d}/{m}/{y} 23:59
              </div>
            ) : null}
            <Rule />
          </div>
          <div style={{ position: "absolute", left: paperLeft, top: (wide ? 1080 : 1920) - paperBottom }}>
            <Zigzag width={paperW} color={theme.paperBg} tooth={20 * s} />
          </div>
          {/* Scene content, inside the paper below the header. */}
          <ContentRectContext.Provider
            value={{
              left: paperLeft + padX,
              right: (wide ? 1920 : 1080) - paperLeft - paperW + padX,
              top: paperTop + header,
              bottom: paperBottom + 48 * s,
              align: "left",
            }}
          >
            {children}
          </ContentRectContext.Provider>
        </div>
      </Camera>
      <Footer font={font.family} size={28} weight={700} color={theme.fg} bottom={wide ? 40 : 64} />
    </AbsoluteFill>
  );
};
