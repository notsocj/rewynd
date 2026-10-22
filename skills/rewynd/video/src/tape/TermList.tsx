// Ranked rows (agents, projects, tools, repos), drawn in the current
// TEMPLATE's style so every list in the video matches its card:
//
//   tape      a tracklist:   01  Edit files              1,204×
//                            ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮ (segmented level meter)
//   terminal  output rows:   01 edit_files                 1,204
//                            ████████████████░░░░ (solid bar)
//   receipt   itemized:      01 EDIT FILES ............... 1,204
//   arcade    high scores:   1ST  EDIT FILES          1204   (one color per rank)
//
// Names come from the user's machine (project folders, repos), so they can
// be anything: very long, emoji, odd characters. The name truncates with "…"
// and the value never wraps, so a row can never break the layout.

import React from "react";
import { useRecap } from "../recap/context";
import { Appear, ellipsis } from "../components/Appear";
import { snake } from "../templates/frame";
import { LevelMeter } from "./LevelMeter";

export type TermRow = {
  key: string;
  name: string;
  value: string;
  sub?: string; // quieter line under the name
  comment?: string; // a "# like this" code comment line, e.g. Claude's one-liner
  meter?: number; // 0..1 share of the top row
};

type Props = {
  rows: TermRow[];
  width: number; // inner width of the list
  delay?: number;
  nameSize?: number;
  // Shown when there are no rows at all.
  empty?: string;
};

const ORDINALS = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH", "9TH", "10TH"];

export const TermList: React.FC<Props> = ({ rows, width, delay = 24, nameSize = 60, empty = "(nothing to show)" }) => {
  const { theme, font, s } = useRecap();
  const t = theme.template;

  if (rows.length === 0) {
    return (
      <Appear delay={delay}>
        <div style={{ fontSize: 40 * s, fontWeight: 700, color: theme.panelDim }}>{empty}</div>
      </Appear>
    );
  }

  // ---------------- ARCADE: a high-score table, one color per rank ----------------
  if (t === "arcade") {
    const colors = [theme.accent, theme.cyan, theme.pink, theme.add, theme.fg];
    const cell: React.CSSProperties = { fontFamily: font.ui, fontSize: 32 * s, lineHeight: 1.3, ...ellipsis };
    return (
      <div style={{ display: "grid", gridTemplateColumns: `${150 * s}px minmax(0, 1fr) auto`, columnGap: 24 * s, rowGap: 46 * s, textAlign: "left", alignItems: "center" }}>
        {["RANK", "NAME", "SCORE"].map((h, i) => (
          <div key={h} style={{ ...cell, fontSize: 22 * s, textAlign: i === 2 ? "right" : "left" }}>
            {h}
          </div>
        ))}
        {rows.map((row, i) => (
          <React.Fragment key={row.key}>
            {[ORDINALS[i] ?? `${i + 1}TH`, row.name.toUpperCase(), row.value.toUpperCase()].map((text, j) => (
              <Appear key={j} delay={delay + i * 4} distance={0}>
                <div style={{ ...cell, color: colors[i % colors.length], textAlign: j === 2 ? "right" : "left" }}>{text}</div>
              </Appear>
            ))}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // ---------------- RECEIPT: itemized lines with dotted leaders ----------------
  if (t === "receipt") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 26 * s, textAlign: "left" }}>
        {rows.map((row, i) => (
          <Appear key={row.key} delay={delay + i * 4} distance={10}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 * s }}>
              <span style={{ fontSize: 26 * s, color: theme.dim, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontWeight: 700, fontSize: 40 * s, ...ellipsis, maxWidth: "62%" }}>{row.name.toUpperCase()}</span>
              {/* The dotted leader line, like a printed price list. */}
              <span style={{ flexGrow: 1, borderBottom: `${4 * s}px dotted ${theme.fg}`, translate: `0 ${-10 * s}px`, minWidth: 20 * s }} />
              <span style={{ fontWeight: 700, fontSize: 40 * s, whiteSpace: "nowrap" }}>{row.value.toUpperCase()}</span>
            </div>
            {row.sub ? <div style={{ fontSize: 24 * s, color: theme.dim, marginLeft: 50 * s, ...ellipsis }}>{row.sub}</div> : null}
          </Appear>
        ))}
      </div>
    );
  }

  // ---------------- TAPE + TERMINAL: rank, name, value, then a meter ----------------
  const term = t === "terminal";
  const rankWidth = (term ? 64 : 64) * s;
  const gap = 22 * s;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: (term ? 44 : 50) * s, textAlign: "left" }}>
      {rows.map((row, i) => (
        // Rows print one after another, like command output.
        <Appear key={row.key} delay={delay + i * 4} distance={16}>
          <div style={{ display: "flex", alignItems: "baseline", gap }}>
            <span
              style={{
                width: rankWidth,
                flexShrink: 0,
                fontFamily: font.ui,
                fontSize: (term ? 44 : 56) * s,
                fontWeight: term ? 800 : 400,
                color: theme.panelDim,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                flexGrow: 1,
                fontFamily: term ? font.ui : font.family,
                fontSize: (term ? 48 : nameSize * 1.1) * s,
                fontWeight: term ? 700 : font.black,
                letterSpacing: term ? 0 : "-0.03em",
                lineHeight: 1.1,
                ...ellipsis,
              }}
            >
              {term ? snake(row.name) || row.name : row.name}
            </span>
            <span
              style={{
                fontFamily: font.ui,
                fontSize: (term ? 40 : 60) * s,
                color: term ? theme.accent : theme.fg,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {row.value}
            </span>
          </div>
          {row.sub ? (
            <div style={{ fontFamily: term ? font.ui : font.family, fontSize: 30 * s, color: theme.panelDim, marginTop: 4 * s, marginLeft: rankWidth + gap, ...ellipsis }}>
              {row.sub}
            </div>
          ) : null}
          {row.comment ? (
            <div style={{ fontFamily: font.ui, fontSize: (term ? 30 : 38) * s, color: theme.add, marginTop: 4 * s, marginLeft: rankWidth + gap, ...ellipsis }}>
              # {row.comment}
            </div>
          ) : null}
          {row.meter !== undefined ? (
            <div style={{ marginTop: 18 * s }}>
              <LevelMeter
                value={row.meter}
                width={width}
                height={(term ? 28 : 32) * s}
                variant={term ? "solid" : "segments"}
                onColor={theme.accent}
                hotColor={theme.accent}
                offColor={theme.meterOff}
                delay={delay + i * 4 + 4}
              />
            </div>
          ) : null}
        </Appear>
      ))}
    </div>
  );
};

/** Inner content width of a TerminalWindow of the given outer width. On the
 *  tape template that's the window minus padding and border; elsewhere the
 *  "window" is just the space itself. */
export const terminalInner = (outer: number, s: number) => outer - 72 * s - 6 * s;
