// The giant number at the heart of most scenes, with an optional unit
// ("hrs", "%", "days") and a blinking terminal cursor after it, all sitting
// on one baseline.
//
// It sizes itself to the slot it's in (see Stage.tsx), so the same scene
// works in a vertical and a wide video, and a 7-digit number shrinks to fit
// instead of running off the card.

import React from "react";
import { useRecap } from "../recap/context";
import { useSlotWidth } from "../tape/Stage";
import { Cursor } from "../tape/Terminal";
import { Appear } from "./Appear";
import { CountUp, heroFontSize } from "./CountUp";

type Props = {
  value: number;
  unit?: string;
  // Max font size at vertical scale (wide shrinks it automatically).
  maxSize?: number;
  // How much of the slot width the number itself may use; the rest is for
  // the unit and the cursor.
  share?: number;
  delay?: number;
  // A unit like "%" hugs the number and is set bigger than a word unit.
  tightUnit?: boolean;
  cursor?: boolean;
};

export const Hero: React.FC<Props> = ({
  value,
  unit,
  maxSize = 430,
  share = 0.7,
  delay = 14,
  tightUnit = false,
  cursor = true,
}) => {
  const { theme, font, s } = useRecap();
  const width = useSlotWidth();
  const size = heroFontSize(value, font, width * share, maxSize * s);

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: tightUnit ? 0 : 24 * s, whiteSpace: "nowrap" }}>
      <CountUp value={value} font={font} fontSize={size} color={theme.accent} textShadow={theme.osdShadow} delay={delay} />
      {unit || cursor ? (
        <Appear delay={delay + 10} distance={0}>
          <span
            style={{
              fontSize: size * (tightUnit ? 0.6 : 0.26),
              fontWeight: font.black,
              letterSpacing: "-0.02em",
              color: tightUnit ? theme.accent : theme.fg,
              textShadow: theme.osdShadow,
            }}
          >
            {unit}
            {/* The cursor waits after the output, like a terminal ready for
                the next command. */}
            {cursor ? (
              <span style={{ marginLeft: "0.25em", fontSize: tightUnit ? "0.43em" : undefined }}>
                <Cursor color={theme.accent} />
              </span>
            ) : null}
          </span>
        </Appear>
      ) : null}
    </div>
  );
};

/** A big word or short string (like "2AM" or "Claude Code") set in the
 *  hero style, sized from its length to fit the slot. */
export const HeroText: React.FC<{
  text: string;
  maxSize?: number;
  minSize?: number;
  share?: number;
  color?: string;
  delay?: number;
}> = ({ text, maxSize = 360, minSize = 76, share = 0.9, color, delay = 14 }) => {
  const { theme, font, s } = useRecap();
  const width = useSlotWidth();
  // ~0.6em per character for Inter Black; the slot width decides the rest.
  // Never below minSize: a very long name stays big and truncates with "…"
  // instead of shrinking to an unreadable size.
  const size = Math.max(minSize * s, Math.min(maxSize * s, (width * share) / Math.max(1, text.length * 0.6)));
  return (
    <Appear delay={delay} distance={30}>
      <div
        style={{
          fontSize: size,
          fontWeight: font.black,
          letterSpacing: font.heroTracking,
          lineHeight: 0.9,
          color: color ?? theme.accent,
          textShadow: theme.osdShadow,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </div>
    </Appear>
  );
};

/** One line of caption text in the standard caption style. */
export const Caption: React.FC<{ children: React.ReactNode; delay: number; size?: number; dim?: boolean }> = ({
  children,
  delay,
  size = 52,
  dim = false,
}) => {
  const { theme, s } = useRecap();
  return (
    <Appear delay={delay}>
      <div
        style={{
          fontSize: size * s,
          fontWeight: dim ? 600 : 500,
          lineHeight: 1.22,
          color: dim ? theme.dim : theme.fg,
          textShadow: theme.osdShadow,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </div>
    </Appear>
  );
};
