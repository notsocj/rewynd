// The frame every scene is built on. Which frame depends on the user's
// TEMPLATE (theme.template):
//
//   tape     camcorder display (REC + date + timecode), transport buttons,
//            scan lines, footer                       → templates/frames/Tape
//   terminal the whole card is one terminal window     → templates/frames/Terminal
//   receipt  a strip of till paper on a color field    → templates/frames/Receipt
//   arcade   an 8-bit cabinet screen                   → templates/frames/Arcade
//
// Every frame puts the scene's content inside the camcorder <Camera> (so it
// drifts while the frame stays locked) and tells <Stage> where the free
// space is (ContentRectContext). Scenes just write <TapeCard>…</TapeCard>.

import React from "react";
import { useRecap } from "../recap/context";
import { ArcadeFrame } from "../templates/frames/Arcade";
import { ReceiptFrame } from "../templates/frames/Receipt";
import { TapeFrame } from "../templates/frames/Tape";
import { TerminalFrame } from "../templates/frames/Terminal";
import type { TransportButton } from "./Transport";

export type CardProps = {
  counter?: string; // text for the tape counter (optional)
  active?: TransportButton; // which transport button is pressed (tape)
  // Hide the tape transport row (some full-bleed card designs leave it out).
  transport?: boolean;
  // Replace the date in the tape's top-right corner (e.g. "03:00 AM").
  osdRight?: string;
  children: React.ReactNode;
};

export const TapeCard: React.FC<CardProps> = (props) => {
  const { theme } = useRecap();
  switch (theme.template) {
    case "terminal":
      return <TerminalFrame {...props} />;
    case "receipt":
      return <ReceiptFrame {...props} />;
    case "arcade":
      return <ArcadeFrame {...props} />;
    default:
      return <TapeFrame {...props} />;
  }
};
