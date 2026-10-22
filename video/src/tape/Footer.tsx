// The last line of every card: "made with rewynd" plus the repo URL.
// This is the growth loop: every shared video advertises the project, and
// the URL is written out because screenshots lose links.

import React from "react";
import { useRecap } from "../recap/context";
import { RewindIcon } from "./Icons";
import { frameFor } from "./layout";

export const Footer: React.FC = () => {
  const { theme, font, wide, s, repoUrl } = useRecap();
  const f = frameFor(wide);

  return (
    <div
      style={{
        position: "absolute",
        left: f.side,
        // Vertical: spread across the width. Wide: left half only, because
        // the transport bar takes the right side of the same row.
        ...(wide ? { width: 980, gap: 36 } : { right: f.side, justifyContent: "space-between" }),
        bottom: f.footerBottom,
        display: "flex",
        alignItems: "center",
        fontFamily: font.family,
        color: theme.fg,
        textShadow: theme.osdShadow,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 * s, fontSize: 34 * s, fontWeight: 800 }}>
        <RewindIcon size={36 * s} color={theme.fg} />
        made with rewynd
      </div>
      <div style={{ fontSize: 30 * s, fontWeight: 600, color: theme.dim, overflow: "hidden", textOverflow: "ellipsis" }}>
        {repoUrl}
      </div>
    </div>
  );
};
