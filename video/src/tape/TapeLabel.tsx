// The tape label: the paper sticker you'd write on before shoving a tape in
// the VCR. It sits at the top of most scenes, and it's what makes every
// card read as "a recording of your month".
//
// Built from: three colored bands across the top (like the stripes on old
// tape labels), a small line of caps ("TAPE 01 · HOURS WITH AI"), the big
// title ("OCTOBER '26"), and one ruled writing line.
//
// Motion: the sticker drops in slightly rotated and settles, like it was
// slapped on by hand.

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useRecap } from "../recap/context";
import { isLight } from "../theme";

type Props = {
  title: string;
  subtitle: string;
  // Extra scale on top of the format scale (the intro uses a bigger label).
  size?: number;
  delay?: number;
};

export const TapeLabel: React.FC<Props> = ({ title, subtitle, size = 1, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, font, s } = useRecap();
  const k = s * size;
  const drop = spring({ frame: frame - delay, fps, config: { damping: 13, mass: 0.7 } });

  return (
    <div
      style={{
        display: "inline-block",
        maxWidth: "100%",
        background: theme.label,
        color: theme.labelFg,
        fontFamily: font.family,
        borderRadius: 10 * k,
        overflow: "hidden",
        // On the light theme the sticker needs an outline to separate it
        // from the off-white background.
        border: isLight(theme) ? `${3 * k}px solid ${theme.labelFg}` : undefined,
        // A hard shadow, not a blurry one: keeps the flat, printed look.
        boxShadow: theme.hardShadow,
        // Ends slightly crooked (-1.5°): a hand-stuck label is never straight.
        rotate: `${interpolate(drop, [0, 1], [-7, -1.5])}deg`,
        translate: `0 ${interpolate(drop, [0, 1], [-60, 0])}px`,
        opacity: interpolate(drop, [0, 0.25], [0, 1], { extrapolateRight: "clamp" }),
      }}
    >
      {theme.stripes.map((c, i) => (
        <div key={i} style={{ height: 12 * k, background: c }} />
      ))}
      <div style={{ padding: `${22 * k}px ${40 * k}px ${26 * k}px` }}>
        <div
          style={{
            fontSize: 28 * k,
            fontWeight: 800,
            letterSpacing: "0.12em",
            opacity: 0.65,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            fontSize: 104 * k,
            fontWeight: font.black,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginTop: 6 * k,
            // The ruled writing line under the title.
            paddingBottom: 14 * k,
            borderBottom: `${3 * k}px solid ${theme.labelFg}`,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
};
