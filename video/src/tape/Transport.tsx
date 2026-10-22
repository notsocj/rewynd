// The tape-deck button row near the bottom of every card:
// [◀◀ REW] [▶ PLAY] [■ STOP] [● REC]. One button is "pressed" (filled).
//
// It does two jobs: it sells the "you're watching a tape" idea, and it
// tells the viewer what's happening. Stat cards show PLAY, the personality
// reveal shows REC ("this is you, on tape"), the outro shows STOP, and the
// rewind glitch at the start of each scene shows REW.

import React from "react";
import { useRecap } from "../recap/context";
import { PlayIcon, RecIcon, RewindIcon, StopIcon } from "./Icons";
import { frameFor } from "./layout";

export type TransportButton = "rew" | "play" | "stop" | "rec";

const buttons: { id: TransportButton; label: string; Icon: typeof PlayIcon }[] = [
  { id: "rew", label: "REW", Icon: RewindIcon },
  { id: "play", label: "PLAY", Icon: PlayIcon },
  { id: "stop", label: "STOP", Icon: StopIcon },
  { id: "rec", label: "REC", Icon: RecIcon },
];

export const Transport: React.FC<{ active: TransportButton }> = ({ active }) => {
  const { theme, font, wide, s } = useRecap();
  const f = frameFor(wide);

  return (
    <div
      style={{
        position: "absolute",
        // Vertical: full width above the footer. Wide: a compact row in the
        // bottom-right corner, sharing the line with the footer.
        ...(wide ? { right: f.side, width: 640 } : { left: f.side, right: f.side }),
        bottom: f.transportBottom,
        display: "flex",
        gap: 16 * s,
      }}
    >
      {buttons.map(({ id, label, Icon }) => {
        const on = id === active;
        // The REC icon stays red even on the pressed button: red means record.
        const iconColor = id === "rec" ? theme.rec : on ? theme.bg : theme.fg;
        return (
          <div
            key={id}
            style={{
              flex: 1,
              height: 76 * s,
              borderRadius: 12 * s,
              border: `${3 * s}px solid ${theme.fg}`,
              background: on ? theme.fg : "transparent",
              color: on ? theme.bg : theme.fg,
              // Unpressed buttons step back so the pressed one reads first.
              opacity: on ? 1 : 0.45,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12 * s,
              fontFamily: font.family,
              fontWeight: 800,
              fontSize: 28 * s,
              letterSpacing: "0.1em",
            }}
          >
            <Icon size={28 * s} color={iconColor} />
            {label}
          </div>
        );
      })}
    </div>
  );
};
