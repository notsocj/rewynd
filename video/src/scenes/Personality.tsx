// Scene "personality": the coder personality reveal, the moment people
// screenshot. The personality's pin badge sits in a camcorder viewfinder
// with a burned-in time/date stamp from your busiest hour and day, REC is
// pressed ("this is you, on tape"), and the name lands below.

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
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
          scale: interpolate(pop, [0, 1], [0.4, 1]),
          rotate: `${interpolate(pop, [0, 1], [-12, 0])}deg`,
          opacity: interpolate(pop, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <Badge personality={props.story.personality.id} />
      </div>
    </Viewfinder>
  );
};

const Reveal: React.FC = () => {
  const { props, theme, font, s, wide, text } = useRecap();
  const p = props.story.personality;
  const title = p.title || PERSONALITIES[p.id]?.title || "The Coder";
  return (
    <div style={{ textAlign: wide ? "left" : "center", textShadow: theme.osdShadow }}>
      {/* Written as a code comment instead of a boxed label. */}
      <Appear delay={28}>
        <div style={{ fontSize: 40 * s, fontWeight: 700, color: theme.dim }}>// my coder personality</div>
      </Appear>
      <Appear delay={34} distance={30}>
        <div
          style={{
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

export const Personality: React.FC = () => (
  // REC is pressed on this card: "this is you, on tape".
  <TapeCard active="rec">
    <Stage scene="personality" primaryShare={0.46} primary={<Shot />} secondary={<Reveal />} />
  </TapeCard>
);
