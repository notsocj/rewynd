// TERMINAL frame: the whole card is one terminal window.
//
//   ┌ ● ● ●  ~/rewynd — october.log ─────────┐
//   │ …scene content (command output)…        │
//   │ $ █                                     │  ← waiting for the next command
//   │ made with rewynd · github.com/…         │
//   └─────────────────────────────────────────┘
//
// GitHub-dark colors, JetBrains Mono everywhere, no scan lines.

import React from "react";
import { AbsoluteFill } from "remotion";
import { useRecap } from "../../recap/context";
import { Camera } from "../../tape/Camera";
import { Footer } from "../../tape/Footer";
import { Cursor } from "../../tape/Terminal";
import { ContentRectContext, SCENE_TITLES, snake, useSceneId } from "../frame";
import type { CardProps } from "../../tape/TapeCard";

const pad = (n: number) => String(n).padStart(2, "0");

/** The window title for a scene, e.g. "~/rewynd — october.log". */
const useWindowTitle = () => {
  const scene = useSceneId();
  const { props } = useRecap();
  const { period, time } = props.stats;
  if (scene === "hours" || scene === "intro") return `~/rewynd — ${period.label.split(" ")[0].toLowerCase()}.log`;
  if (scene === "personality") return `~/rewynd — ${time.busiestHour !== null ? `${pad(time.busiestHour)}:00` : "whoami"}`;
  return `~/rewynd — ${snake(SCENE_TITLES[scene])}`;
};

export const TerminalFrame: React.FC<CardProps> = ({ children }) => {
  const { theme, font, wide, s } = useRecap();
  const title = useWindowTitle();
  const outer = wide ? 40 : 56; // card padding around the window
  const inner = wide ? 44 : 52; // window padding around the content
  const bar = 82 * s; // title bar height

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, color: theme.fg, fontFamily: font.family, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: outer,
          background: theme.panel,
          border: `${2 * s}px solid ${theme.panelBorder}`,
          borderRadius: 28 * s,
          overflow: "hidden",
        }}
      >
        {/* Title bar: the three window dots, then the title. */}
        <div
          style={{
            height: bar,
            display: "flex",
            alignItems: "center",
            gap: 16 * s,
            padding: `0 ${36 * s}px`,
            borderBottom: `${2 * s}px solid ${theme.panelBorder}`,
          }}
        >
          {theme.stripes.map((c) => (
            <span key={c} style={{ width: 24 * s, height: 24 * s, borderRadius: 12 * s, background: c }} />
          ))}
          <span style={{ marginLeft: 12 * s, fontSize: 28 * s, color: theme.dim, whiteSpace: "nowrap" }}>{title}</span>
        </div>
      </div>

      <ContentRectContext.Provider
        value={{ left: outer + inner, right: outer + inner, top: outer + bar + inner, bottom: outer + inner + 150 * s, align: "left" }}
      >
        <Camera>{children}</Camera>
      </ContentRectContext.Provider>

      {/* The prompt waiting for the next command, then the footer. */}
      <div
        style={{
          position: "absolute",
          left: outer + inner,
          bottom: outer + inner + 60 * s,
          display: "flex",
          alignItems: "center",
          gap: 20 * s,
          fontSize: 38 * s,
        }}
      >
        <span style={{ color: theme.accent }}>$</span>
        <Cursor color={theme.fg} width="0.62em" height="1.2em" />
      </div>
      <Footer side={outer + inner} bottom={outer + inner} size={26} uppercase={false} inline />
    </AbsoluteFill>
  );
};
