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
import { FitBox } from "./FitBox";
import { frameFor } from "./layout";
import { TapeLabel } from "./TapeLabel";

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
  const { wide, s, props, tapeNumber } = useRecap();
  const f = frameFor(wide);
  const full = width - f.side * 2;

  const label = tapeSubtitle ? (
    <TapeLabel title={props.stats.period.tapeLabel} subtitle={`TAPE ${tapeNumber(scene)} · ${tapeSubtitle}`} size={0.82} />
  ) : null;

  if (!wide) {
    return (
      <div
        style={{
          position: "absolute",
          left: f.side,
          width: full,
          top: f.contentTop + 30,
          bottom: 1920 - f.contentBottom,
        }}
      >
        <FitBox align={center ? "center" : "top"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
            {label ? <div>{label}</div> : null}
            <SlotWidth.Provider value={full}>
              <div>{primary}</div>
              {secondary ? <div>{secondary}</div> : null}
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
        left: f.side,
        width: full,
        top: f.contentTop,
        bottom: 1080 - f.contentBottom,
        display: "flex",
        gap: WIDE_GAP,
        alignItems: "center",
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
