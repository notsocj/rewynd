// Scene "personality": the coder personality reveal, the moment people
// screenshot. The personality's pin badge sits in a camcorder viewfinder
// with a burned-in time/date stamp from your busiest hour and day, REC is
// pressed ("this is you, on tape"), and the name lands below.

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, EASE_OUT, SPRING } from "../components/motion";
import { PERSONALITIES } from "../../../contract/recap";
import { Appear } from "../components/Appear";
import { stampDay } from "../components/format";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { Viewfinder } from "../tape/Viewfinder";
import { Badge } from "./badges/Badge";

// Camcorder-style time: "AM 2:00".
const camTime = (h: number) => `${h < 12 ? "AM" : "PM"} ${h % 12 === 0 ? 12 : h % 12}:00`;

const Shot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { props, s, wide } = useRecap();
  const width = useSlotWidth();
  const { time } = props.stats;
  // The badge pops in with a slight overshoot and a twist, like a pin being
  // slapped onto a jacket.
  const pop = spring({ frame: frame - 14, fps, config: { damping: 11, mass: 0.8 } });
  const badgeW = 420 * s;
  // Focus pull: the badge starts out of focus and sharpens as the viewfinder
  // brackets snap in, like the camcorder finding its subject.
  const blur = interpolate(frame, [14, 30], [14, 0], { ...CLAMP, easing: EASE_OUT });
  // Once it has landed, the pin floats a little, so the screenshot moment
  // still breathes (slow sines, a few px, never a big wobble).
  const t = Math.max(0, frame - 30) / fps;
  const floatY = 8 * Math.sin(t * 2.1) * Math.min(1, t * 2);
  const floatR = 1.2 * Math.sin(t * 1.5) * Math.min(1, t * 2);

  return (
    <Viewfinder
      width={width}
      height={wide ? 700 : 840}
      stampLeft={time.busiestHour !== null ? camTime(time.busiestHour) : undefined}
      stampRight={time.busiestDay ? stampDay(time.busiestDay.date) : undefined}
      delay={4}
    >
      <div
        style={{
          width: badgeW,
          height: badgeW * (520 / 420),
          // Leave room for the date stamp under the badge.
          marginBottom: 60 * s,
          scale: interpolate(pop, [0, 1], [0.6, 1]),
          rotate: `${interpolate(pop, [0, 1], [-12, 0]) + floatR}deg`,
          translate: `0 ${floatY}px`,
          opacity: interpolate(pop, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
          filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
        }}
      >
        <Badge personality={props.story.personality.id} />
      </div>
    </Viewfinder>
  );
};

// The title doesn't fade in: it's STAMPED. It drops from 115% to 100% on a
// snappy spring, right as the camera flash fires.
const TITLE_AT = 34;

const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stamp = spring({ frame: frame - TITLE_AT, fps, config: SPRING.snappy });
  const { props, theme, font, s, wide, text } = useRecap();
  const p = props.story.personality;
  const title = p.title || PERSONALITIES[p.id]?.title || "The Coder";
  return (
    <div style={{ textAlign: wide ? "left" : "center", textShadow: theme.osdShadow }}>
      {/* Written as a code comment instead of a boxed label. */}
      <Appear delay={28}>
        <div style={{ fontSize: 40 * s, fontWeight: 700, color: theme.dim }}>// my coder personality</div>
      </Appear>
      <Appear delay={TITLE_AT} distance={0}>
        <div
          style={{
            scale: interpolate(stamp, [0, 1], [1.15, 1]),
            transformOrigin: wide ? "left center" : "center",
            marginTop: 14 * s,
            // Long titles step down a size instead of overflowing.
            fontSize: (title.length > 18 ? 92 : 112) * s,
            fontWeight: font.black,
            letterSpacing: font.heroTracking,
            lineHeight: 1,
          }}
        >
          {title}
        </div>
      </Appear>
      <Appear delay={42}>
        <div style={{ marginTop: 24 * s, fontSize: 44 * s, fontWeight: 500, lineHeight: 1.25 }}>{text(p.line)}</div>
      </Appear>
    </div>
  );
};

// A camera flash: the whole picture blows out white for an instant as the
// title lands, then fades fast (ease-out). This is the one "photo moment"
// of the video, the frame people screenshot.
const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [TITLE_AT, TITLE_AT + 9], [0.7, 0], { ...CLAMP, easing: EASE_OUT });
  return frame >= TITLE_AT && opacity > 0 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity, pointerEvents: "none" }} /> : null;
};

export const Personality: React.FC = () => (
  // REC is pressed on this card: "this is you, on tape".
  <TapeCard active="rec">
    <Stage scene="personality" primaryShare={0.46} primary={<Shot />} secondary={<Reveal />} />
    <Flash />
  </TapeCard>
);
