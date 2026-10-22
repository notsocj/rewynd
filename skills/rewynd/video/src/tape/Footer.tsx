// The last line of every card: "made with rewynd" plus the repo URL.
// This is the growth loop: every shared video advertises the project, and
// the URL is written out because screenshots lose links.
//
// Each template sets it in its own voice: the frame passes the font, color
// and position; this component only does the layout.

import React from "react";
import { useRecap } from "../recap/context";

type Props = {
  font?: string;
  size?: number; // px at vertical scale
  color?: string;
  weight?: number;
  bottom?: number;
  side?: number;
  // Lower-case "made with rewynd · url" on one line (terminal style).
  inline?: boolean;
  uppercase?: boolean;
};

export const Footer: React.FC<Props> = ({ font, size = 40, color, weight = 400, bottom, side = 80, inline = false, uppercase = true }) => {
  const { theme, font: f, wide, s, repoUrl } = useRecap();
  const label = uppercase ? "MADE WITH REWYND" : "made with rewynd";
  const style: React.CSSProperties = {
    position: "absolute",
    left: side,
    right: side,
    bottom: bottom ?? (wide ? 40 : 80),
    display: "flex",
    justifyContent: inline ? "flex-start" : "space-between",
    gap: 24 * s,
    fontFamily: font ?? f.ui,
    fontSize: size * s,
    fontWeight: weight,
    color: color ?? theme.dim,
    whiteSpace: "nowrap",
    letterSpacing: uppercase ? 1 * s : 0,
  };
  return inline ? (
    <div style={style}>
      {label} · {repoUrl}
    </div>
  ) : (
    <div style={style}>
      <span>{label}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{repoUrl}</span>
    </div>
  );
};
