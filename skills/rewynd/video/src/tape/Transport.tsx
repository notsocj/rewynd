// The tape-deck button row near the bottom of a TAPE card:
// [◀◀ REW] [▶ PLAY] [■ STOP]. One button is "pressed" (filled with the accent).
//
// It sells the "you're watching a tape" idea and says what's happening: the
// rewind glitch at the start of each scene shows REW, stat cards show PLAY,
// the outro shows STOP. (The REC moment, the personality reveal, shows PLAY:
// the blinking REC dot at the top already says "recording".)
//
// Motion: when the glitch ends, the card's button physically presses in: it
// dips to 92% and springs back as it lights up, like a real deck's button.

import React, { useContext } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, GLITCH_FRAMES, SPRING } from "../components/motion";
import { useRecap } from "../recap/context";
import { RewindingContext } from "./RewindGlitch";

export type TransportButton = "rew" | "play" | "stop" | "rec";

const buttons: { id: TransportButton; label: string }[] = [
  { id: "rew", label: "◀◀ REW" },
  { id: "play", label: "▶ PLAY" },
  { id: "stop", label: "■ STOP" },
];

export const Transport: React.FC<{ active: TransportButton }> = ({ active }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font, wide, s } = useRecap();
  const rewinding = useContext(RewindingContext);
  const pressed = active === "rec" ? "play" : active;
  // 0 → 1 as the card's own button is pushed, right after the glitch.
  const press = rewinding ? 1 : spring({ frame: frame - GLITCH_FRAMES, fps, config: SPRING.snappy });

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        bottom: wide ? 96 : 156,
        display: "flex",
        gap: 20 * s,
        fontFamily: font.ui,
        fontSize: 48 * s,
      }}
    >
      {buttons.map(({ id, label }) => {
        const on = id === pressed;
        // The pushed button dips in, then springs back to full size.
        const dip = on ? interpolate(press, [0, 0.35, 1], [1, 0.92, 1], CLAMP) : 1;
        return (
          <span
            key={id}
            style={{
              padding: `${4 * s}px ${24 * s}px`,
              borderRadius: 12 * s,
              border: `${4 * s}px solid ${on ? theme.accent : theme.panelBorder}`,
              background: on ? theme.accent : "transparent",
              color: on ? theme.bg : theme.fg,
              opacity: on ? interpolate(press, [0, 0.35], [0.5, 1], CLAMP) : 1,
              scale: dip,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
};
