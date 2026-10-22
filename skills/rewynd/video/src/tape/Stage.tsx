// The content layout every scene uses, so each scene works in both sizes
// without its own layout code:
//
//   vertical (9:16)            wide (16:9)
//   ┌──────────────┐           ┌────────────────────────────┐
//   │ tape label   │           │ tape label    │            │
//   │ primary      │           │ primary       │ secondary  │
//   │ secondary    │           │               │            │
//   └──────────────┘           └────────────────────────────┘
//
// "primary" is the big thing (hero number, headline). "secondary" is the
// supporting detail (list, timeline, calendar). Each slot tells its
// children how wide it is through useSlotWidth(), so hero numbers and
// meters can size themselves.

import React, { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";
import type { SceneId } from "../../../contract/recap";
import { useRecap } from "../recap/context";
import { Heading } from "../templates/Heading";
import { useContentRect } from "../templates/frame";
import { FitBox } from "./FitBox";

const SlotWidth = createContext(888);

/** Width in px of the Stage slot this component is inside. */
export const useSlotWidth = () => useContext(SlotWidth);

type Props = {
  scene: SceneId;
  // Small caps text on the tape label, e.g. "HOURS WITH AI". Leave out to
  // skip the label.
  tapeSubtitle?: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  // Wide only: how much of the width the left column takes (0–1).
  primaryShare?: number;
  // Vertical only: center the content block vertically instead of
  // starting at the top (for scenes with little content).
  center?: boolean;
};

const WIDE_GAP = 80;

export const Stage: React.FC<Props> = ({ scene, tapeSubtitle, primary, secondary, primaryShare = 0.44, center }) => {
  const { width } = useVideoConfig();
  const { wide, s } = useRecap();
  // The free area inside the current template's frame (see templates/frame.ts).
  const r = useContentRect();
  const full = width - r.left - r.right;

  // The scene heading, in the template's voice (tape label, $ command...).
  const label = tapeSubtitle ? <Heading scene={scene} /> : null;

  if (!wide) {
    return (
      <div style={{ position: "absolute", left: r.left, width: full, top: r.top, bottom: r.bottom, textAlign: r.align }}>
        <FitBox align={center ? "center" : "top"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 44, alignItems: r.align === "center" ? "center" : "stretch" }}>
            {label ? <div>{label}</div> : null}
            <SlotWidth.Provider value={full}>
              <div style={{ alignSelf: "stretch" }}>{primary}</div>
              {secondary ? <div style={{ alignSelf: "stretch" }}>{secondary}</div> : null}
            </SlotWidth.Provider>
          </div>
        </FitBox>
      </div>
    );
  }

  // Wide: two columns. With no secondary, the primary gets the full width.
  const leftWidth = secondary ? Math.round((full - WIDE_GAP) * primaryShare) : full;
  const rightWidth = full - WIDE_GAP - leftWidth;

  return (
    <div
      style={{
        position: "absolute",
        left: r.left,
        width: full,
        top: r.top,
        bottom: r.bottom,
        display: "flex",
        gap: WIDE_GAP,
        alignItems: "center",
        textAlign: r.align,
      }}
    >
      <div style={{ width: leftWidth, height: "100%" }}>
        <FitBox align="center">
          <div style={{ display: "flex", flexDirection: "column", gap: 40 * s }}>
            {label ? <div>{label}</div> : null}
            <SlotWidth.Provider value={leftWidth}>
              <div>{primary}</div>
            </SlotWidth.Provider>
          </div>
        </FitBox>
      </div>
      {secondary ? (
        <div style={{ width: rightWidth, height: "100%" }}>
          <FitBox align="center">
            <SlotWidth.Provider value={rightWidth}>{secondary}</SlotWidth.Provider>
          </FitBox>
        </div>
      ) : null}
    </div>
  );
};
