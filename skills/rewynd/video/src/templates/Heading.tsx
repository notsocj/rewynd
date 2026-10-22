// The heading at the top of a scene, in the voice of the current template.
// It replaces v0.1's tape-label sticker:
//
//   tape      a handwritten paper label:  [ Top tools   SIDE A · OCTOBER '26 ]
//   terminal  the command, then a big snake_case title:  $ rewynd tools --top 5
//                                                        top_tools
//   receipt   a centered line + dashed rule:  ITEMIZED · TOP TOOLS
//   arcade    a pixel title with a magenta drop shadow:  TOP TOOLS
//
// Motion matches each voice: the sticker is slapped on (drops in tilted),
// the command types itself, the receipt line prints, the pixel title pops.

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneId } from "../../../contract/recap";
import { Appear } from "../components/Appear";
import { CLAMP } from "../components/motion";
import { useRecap } from "../recap/context";
import { TypedPrompt } from "../tape/Terminal";
import { SCENE_COMMANDS, SCENE_TITLES, snake } from "./frame";
import { Rule } from "./frames/Receipt";

type Props = {
  scene: SceneId;
  // Override the title (default: the scene's name, e.g. "Top tools").
  title?: string;
  // Extra scale (the intro uses a bigger heading).
  size?: number;
  delay?: number;
};

export const Heading: React.FC<Props> = ({ scene, title, size = 1, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font, s, props } = useRecap();
  const k = s * size;
  const name = title ?? SCENE_TITLES[scene];
  const period = props.stats.period;

  switch (theme.template) {
    case "terminal":
      return (
        <div>
          {SCENE_COMMANDS[scene] ? <TypedPrompt command={SCENE_COMMANDS[scene]} fontSize={36 * k} delay={delay} textColor={theme.fg} /> : null}
          <Appear delay={delay + 8} distance={20}>
            <div style={{ fontFamily: font.hero, fontWeight: 800, fontSize: 104 * k, letterSpacing: "-0.04em", lineHeight: 1.05, marginTop: 28 * k, overflowWrap: "anywhere" }}>
              {snake(name)}
            </div>
          </Appear>
        </div>
      );

    case "receipt":
      return (
        <Appear delay={delay} distance={0}>
          <div style={{ textAlign: "center", fontSize: 26 * k, letterSpacing: 2 * k }}>
            {scene === "intro" ? `${period.label.toUpperCase()} · YOUR TAPE` : `ITEMIZED · ${name.toUpperCase()}`}
          </div>
          <Rule margin={28} />
        </Appear>
      );

    case "arcade": {
      const pop = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 0.5 } });
      return (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: font.ui,
              fontSize: 56 * k,
              lineHeight: 1.3,
              color: theme.accent,
              textShadow: `${6 * k}px ${6 * k}px 0 ${theme.pink}`,
              scale: interpolate(pop, [0, 1], [0.7, 1]),
              opacity: interpolate(pop, [0, 0.3], [0, 1], CLAMP),
            }}
          >
            {(scene === "intro" ? period.label : name).toUpperCase()}
          </div>
          <Appear delay={delay + 8} distance={0}>
            <div style={{ fontFamily: font.ui, fontSize: 24 * k, color: theme.dim, marginTop: 20 * k }}>
              {scene === "intro" ? "INSERT COIN" : period.label.toUpperCase()}
            </div>
          </Appear>
        </div>
      );
    }

    default: {
      // Tape: a paper label slapped on by hand. Drops in tilted and settles
      // slightly crooked (a hand-stuck label is never straight).
      const drop = spring({ frame: frame - delay, fps, config: { damping: 13, mass: 0.7 } });
      return (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 44 * k,
            maxWidth: "100%",
            background: theme.label,
            color: theme.labelFg,
            borderRadius: 20 * k,
            padding: `${18 * k}px ${40 * k}px`,
            rotate: `${interpolate(drop, [0, 1], [-7, -1.5])}deg`,
            translate: `0 ${interpolate(drop, [0, 1], [-60, 0])}px`,
            opacity: interpolate(drop, [0, 0.25], [0, 1], CLAMP),
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontFamily: font.hand, fontWeight: 700, fontSize: 88 * k, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis" }}>
            {scene === "intro" ? period.label.replace(/ (\d\d)(\d\d)$/, " '$2") : name}
          </span>
          <span style={{ fontFamily: font.ui, fontSize: 44 * k, flexShrink: 0 }}>
            SIDE A · {scene === "intro" ? "REWYND" : period.tapeLabel}
          </span>
        </div>
      );
    }
  }
};
