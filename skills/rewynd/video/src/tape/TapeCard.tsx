// The frame every scene is built on. Back to front:
// 1. the full-bleed background color (the "color field")
// 2. the scene's own content, inside the handheld camera (see Camera.tsx)
// 3. the camcorder OSD at the top (REC + tape counter)
// 4. the transport buttons and the footer at the bottom
// 5. scan lines over everything
//
// Keeping this in one place means every scene gets the same chrome in the
// same spots, inside the safe area, in both sizes (see layout.ts).

import React, { useContext } from "react";
import { AbsoluteFill } from "remotion";
import { Camera } from "./Camera";
import { useRecap } from "../recap/context";
import { Footer } from "./Footer";
import { Osd } from "./Osd";
import { RewindingContext } from "./RewindGlitch";
import { Scanlines } from "./Scanlines";
import { Transport, type TransportButton } from "./Transport";

type Props = {
  counter?: string; // text for the top-right tape counter (optional)
  active?: TransportButton; // which transport button is pressed
  children: React.ReactNode;
};

export const TapeCard: React.FC<Props> = ({ counter, active = "play", children }) => {
  const { theme, font } = useRecap();
  // During the rewind glitch at the start of a scene, REW is pressed.
  const rewinding = useContext(RewindingContext);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: font.family,
        overflow: "hidden",
      }}
    >
      {/* Only the content is "filmed" (drifts with the camera); the
          chrome below stays locked like a viewfinder overlay. */}
      <Camera>{children}</Camera>
      <Osd counter={counter} />
      <Transport active={rewinding ? "rew" : active} />
      <Footer />
      <Scanlines lineColor={theme.scanline} />
    </AbsoluteFill>
  );
};
