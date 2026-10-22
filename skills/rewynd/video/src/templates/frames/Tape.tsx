// TAPE frame: a camcorder recording (rewynd's original identity, updated).
//
//   ● REC                 OCT 31 2026     ← VT323 on-screen display
//   ▶ PLAY   00:86:12:04                  ← running tape counter
//   …scene content…
//   [◀◀ REW] [▶ PLAY] [■ STOP]            ← transport (optional)
//   MADE WITH REWYND      github.com/…    ← footer
//
// Faint scan lines sit over everything, like an old TV picture.

import React, { useContext } from "react";
import { AbsoluteFill } from "remotion";
import { useRecap } from "../../recap/context";
import { Camera } from "../../tape/Camera";
import { Footer } from "../../tape/Footer";
import { Osd } from "../../tape/Osd";
import { RewindingContext } from "../../tape/RewindGlitch";
import { Scanlines } from "../../tape/Scanlines";
import { Transport } from "../../tape/Transport";
import { ContentRectContext } from "../frame";
import type { CardProps } from "../../tape/TapeCard";

export const TapeFrame: React.FC<CardProps> = ({ counter, active = "play", transport = true, osdRight, children }) => {
  const { theme, font, wide } = useRecap();
  const rewinding = useContext(RewindingContext);

  // Free space for content: below the OSD, above the transport + footer.
  const rect = wide
    ? { left: 80, right: 80, top: 170, bottom: transport ? 150 : 110, align: "left" as const }
    : { left: 80, right: 80, top: 300, bottom: transport ? 300 : 190, align: "left" as const };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, color: theme.fg, fontFamily: font.family, overflow: "hidden" }}>
      <ContentRectContext.Provider value={rect}>
        <Camera>{children}</Camera>
      </ContentRectContext.Provider>
      <Osd counter={counter} right={osdRight} />
      {transport ? <Transport active={rewinding ? "rew" : active} /> : null}
      <Footer />
      <Scanlines lineColor={theme.scanline} />
    </AbsoluteFill>
  );
};
