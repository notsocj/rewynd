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

/** How a template paints its giant numbers (the "hero" style). */
export const heroLook = (theme: ReturnType<typeof useRecap>["theme"], s: number) => {
  switch (theme.template) {
    case "terminal": // plain output color; the unit carries the accent
      return { color: theme.fg, shadow: "none", unitColor: theme.accent, unitScale: 0.38, unitFont: "hero" as const, cursor: false };
    case "receipt": // printed ink
      return { color: theme.fg, shadow: "none", unitColor: theme.fg, unitScale: 0.22, unitFont: "ui" as const, cursor: false };
    case "arcade": // accent with a hard magenta drop shadow
      return { color: theme.accent, shadow: `${16 * s}px ${16 * s}px 0 ${theme.pink}`, unitColor: theme.cyan, unitScale: 0.16, unitFont: "ui" as const, cursor: false };
    default: // tape: cream number, the unit in VT323 in the accent color
      return { color: theme.fg, shadow: theme.osdShadow, unitColor: theme.accent, unitScale: 0.3, unitFont: "ui" as const, cursor: false };
  }
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
  const look = heroLook(theme, s);
  const size = heroFontSize(value, font, width * share, maxSize * s);
  const showCursor = cursor && look.cursor;

  return (
    <div
      style={{
        display: "flex",
        // The arcade template centers everything, like a cabinet screen.
        justifyContent: theme.template === "arcade" ? "center" : "flex-start",
        alignItems: "baseline",
        gap: tightUnit ? 0 : 24 * s,
        whiteSpace: "nowrap",
      }}
    >
      <CountUp value={value} font={font} fontSize={size} color={look.color} textShadow={look.shadow} delay={delay} lineHeight={theme.template === "arcade" ? 1.1 : 0.8} />
      {unit || showCursor ? (
        <Appear delay={delay + 10} distance={0}>
          <span
            style={{
              fontFamily: look.unitFont === "hero" ? font.hero : font.ui,
              fontSize: size * (tightUnit ? Math.max(look.unitScale, 0.5) : look.unitScale),
              fontWeight: look.unitFont === "hero" ? font.black : 400,
              letterSpacing: "-0.02em",
              color: look.unitColor,
              textTransform: theme.template === "tape" || theme.template === "arcade" ? "uppercase" : undefined,
            }}
          >
            {unit}
            {/* The cursor waits after the output, like a terminal ready for
                the next command. */}
            {showCursor ? (
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
  // Per-character width depends on the template's hero font (pixel fonts are square).
  const perChar = theme.template === "arcade" ? 1 : theme.template === "terminal" || theme.template === "receipt" ? 0.62 : 0.6;
  const size = Math.max(minSize * s, Math.min(maxSize * s, (width * share) / Math.max(1, text.length * perChar)));
  const look = heroLook(theme, s);
  return (
    <Appear delay={delay} distance={30}>
      <div
        style={{
          fontFamily: font.hero,
          fontSize: size,
          fontWeight: font.black,
          letterSpacing: font.heroTracking,
          lineHeight: 0.9,
          color: color ?? (theme.template === "tape" ? theme.accent : look.color),
          textShadow: look.shadow,
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
