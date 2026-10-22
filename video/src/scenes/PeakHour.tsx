// Scene "peakHour": the hour of the day you coded most, as a big camcorder
// time stamp, with all 24 hours drawn as tape-deck level meters (one column
// per hour, the peak lit in the accent color).

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Appear } from "../components/Appear";
import { hourLabel, plural } from "../components/format";
import { Caption, HeroText } from "../components/Hero";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";

const SEGMENTS = 10; // LED segments per hour column

const HourMeters: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, theme, s } = useRecap();
  const width = useSlotWidth();
  const hours = props.stats.time.hours.length === 24 ? props.stats.time.hours : Array(24).fill(0);
  const peak = props.stats.time.busiestHour;
  const max = Math.max(...hours, 1);
  const gap = 6 * s;
  const colW = (width - gap * 23) / 24;
  const segH = 20 * s;
  const segGap = 5 * s;

  return (
    <div>
      <div style={{ display: "flex", gap, alignItems: "flex-end" }}>
        {hours.map((m, h) => {
          // Columns light up left to right, a couple of frames apart, each
          // filling bottom-up to its level.
          const target = m > 0 ? Math.max(1, Math.round((m / max) * SEGMENTS)) : 0;
          const lit = Math.round(
            interpolate(frame, [12 + h * 1.2, 22 + h * 1.2], [0, target], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          );
          return (
            <div key={h} style={{ width: colW, display: "flex", flexDirection: "column-reverse", gap: segGap }}>
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <div
                  key={i}
                  style={{
                    height: segH,
                    borderRadius: 3,
                    background: i < lit ? (h === peak ? theme.accent : theme.fg) : theme.faint,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      {/* Hour labels every 6 hours. */}
      <div style={{ position: "relative", height: 44 * s, marginTop: 14 * s }}>
        {[0, 6, 12, 18].map((h) => (
          <span
            key={h}
            style={{
              position: "absolute",
              left: h * (colW + gap),
              fontSize: 28 * s,
              fontWeight: 800,
              color: theme.dim,
              textShadow: theme.osdShadow,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {hourLabel(h)}
          </span>
        ))}
      </div>
    </div>
  );
};

export const PeakHour: React.FC = () => {
  const { props, s } = useRecap();
  const { time } = props.stats;
  const peak = time.busiestHour;
  const caption =
    props.story.captions.peakHour ??
    (time.lateNightSessions > 0 ? `${plural(time.lateNightSessions, "session")} started after midnight.` : "A daytime coder. Respect.");

  return (
    <TapeCard counter={peak !== null ? `${String(peak).padStart(2, "0")}:00:00` : undefined}>
      <Stage
        scene="peakHour"
        tapeSubtitle="PEAK HOUR"
        primary={
          <div style={{ display: "flex", flexDirection: "column", gap: 30 * s }}>
            <Appear delay={8}>
              <div style={{ fontSize: 40 * s, fontWeight: 800, letterSpacing: "0.06em" }}>YOU PEAKED AT</div>
            </Appear>
            <HeroText text={peak !== null ? hourLabel(peak) : "—"} maxSize={340} share={0.85} />
            <Caption delay={30}>{caption}</Caption>
          </div>
        }
        secondary={<HourMeters />}
      />
    </TapeCard>
  );
};
