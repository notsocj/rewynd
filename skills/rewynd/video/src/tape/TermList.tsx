// Rows of "command output" inside a terminal window: rank, name, value, an
// optional quieter line under it, and an optional level meter. Used by the
// main-AI, projects, tools and shipped scenes so they all line up the same.
//
// Names come from the user's machine (project folders, repos), so they can
// be anything: very long, emoji, odd characters. The name truncates with
// "…" and the value never wraps, so a row can never break the layout.

import React from "react";
import { useRecap } from "../recap/context";
import { Appear, ellipsis } from "../components/Appear";
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
  width: number; // inner width of the terminal
  delay?: number;
  nameSize?: number;
  // Shown when there are no rows at all.
  empty?: string;
};

export const TermList: React.FC<Props> = ({ rows, width, delay = 24, nameSize = 60, empty = "(nothing to show)" }) => {
  const { theme, font, s } = useRecap();
  const rankWidth = 54 * s;
  const gap = 22 * s;

  if (rows.length === 0) {
    return (
      <Appear delay={delay}>
        <div style={{ fontSize: 40 * s, fontWeight: 700, color: theme.panelDim }}>{empty}</div>
      </Appear>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 * s }}>
      {rows.map((row, i) => (
        // Rows print one after another, like command output.
        <Appear key={row.key} delay={delay + i * 4} distance={16}>
          <div style={{ display: "flex", gap }}>
            <span
              style={{
                width: rankWidth,
                flexShrink: 0,
                fontSize: 34 * s,
                fontWeight: 800,
                color: theme.panelDim,
                fontVariantNumeric: "tabular-nums",
                paddingTop: 12 * s,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20 * s }}>
                <span style={{ fontSize: nameSize * s, fontWeight: font.black, letterSpacing: "-0.03em", lineHeight: 1.1, ...ellipsis }}>
                  {row.name}
                </span>
                <span style={{ fontSize: 42 * s, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {row.value}
                </span>
              </div>
              {row.sub ? (
                <div style={{ fontSize: 30 * s, fontWeight: 600, color: theme.panelDim, marginTop: 4 * s, ...ellipsis }}>{row.sub}</div>
              ) : null}
              {row.comment ? (
                <div style={{ fontSize: 32 * s, fontWeight: 700, color: theme.add, marginTop: 4 * s, ...ellipsis }}># {row.comment}</div>
              ) : null}
              {row.meter !== undefined ? (
                <div style={{ marginTop: 10 * s }}>
                  <LevelMeter
                    value={row.meter}
                    width={width - rankWidth - gap}
                    height={16 * s}
                    onColor={theme.add}
                    hotColor={theme.amber}
                    offColor={theme.meterOff}
                    delay={delay + i * 4 + 4}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </Appear>
      ))}
    </div>
  );
};

/** Inner content width of a TerminalWindow of the given outer width
 *  (outer minus padding and border), for sizing meters inside it. */
export const terminalInner = (outer: number, s: number) => outer - 72 * s - 6 * s;
