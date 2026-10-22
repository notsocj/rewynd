// Dev-only: puts up to four rendered stills side by side with a label over
// each, so design versions can be compared in one image (e.g. "v1 | new A |
// new B"). Not part of the user-facing video.
//
// The stills must be copied into video/public/ first (that folder is what
// staticFile() reads from).

import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { getFont } from "../fonts";
import type { CompareProps } from "../schema";

export const Compare: React.FC<CompareProps> = ({ title, panels }) => {
  const font = getFont(null);
  return (
    <AbsoluteFill style={{ backgroundColor: "#2A2A2A", fontFamily: font.family, color: "#EFEEE9", padding: 40 }}>
      <div style={{ fontSize: 44, fontWeight: 900, marginBottom: 24 }}>{title}</div>
      <div style={{ display: "flex", gap: 40, flex: 1, minHeight: 0 }}>
        {panels.map((p) => (
          // minHeight 0 lets the column shrink to the space left, so the
          // image scales down to fit instead of overflowing the bottom.
          <div key={p.file} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{p.label}</div>
            {/* object-fit: contain keeps each 9:16 still undistorted. */}
            <Img src={staticFile(p.file)} style={{ flex: 1, minHeight: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "top left" }} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
