// Scene "hours": total hours with AI as one giant number, presented like
// terminal output, with the period drawn as a tape timeline underneath.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { countProgress } from "../components/CountUp";
import { num, plural } from "../components/format";
import { Caption, Hero } from "../components/Hero";
import { useRecap } from "../recap/context";
import { DESIGNS } from "../templates/designs";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { TapeTimeline } from "../tape/TapeTimeline";
import { TypedPrompt } from "../tape/Terminal";

// When the big number starts counting (frames into the scene).
const COUNT_DELAY = 14;
const pad = (n: number, width = 2) => String(n).padStart(width, "0");

// The timeline needs its slot's width, so it lives in its own component.
const Timeline: React.FC = () => {
  const { props } = useRecap();
  const width = useSlotWidth();
  return <TapeTimeline heatmap={props.stats.time.heatmap} busiestDay={props.stats.time.busiestDay?.date ?? null} width={width} delay={26} />;
};

export const Hours: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { props, s, theme, wide } = useRecap();
  const { totals, period } = props.stats;
  // Vertical videos use the template's hand-designed card (templates/designs).
  const Designed = DESIGNS[theme.template].hours;
  const minutes = Math.max(0, Math.round(totals.activeMinutes));
  const hours = Math.floor(minutes / 60);

  // The top-right tape counter rolls up in sync with the big number and
  // lands on the real total (hours:minutes:seconds). The seconds keep
  // ticking afterwards so the tape always looks like it's playing.
  const rolled = Math.round(minutes * countProgress(frame, fps, COUNT_DELAY));
  const counter = `${pad(Math.floor(rolled / 60), 3)}:${pad(rolled % 60)}:${pad(Math.floor((frame / fps) * 7) % 60)}`;

  // Default caption: hours as days of pair programming, one decimal.
  const days = (minutes / 60 / 24).toFixed(1);
  const caption = props.story.captions.hours ?? `That's ${days} days of pair programming.`;

  if (!wide) return <Designed />;
  return (
    <TapeCard counter={counter}>
      <Stage
        scene="hours"
        tapeSubtitle="HOURS WITH AI"
        primaryShare={0.5}
        primary={
          <div style={{ display: "flex", flexDirection: "column", gap: 40 * s }}>
            {theme.template === "tape" ? <TypedPrompt command={`rewynd hours --${period.kind}`} fontSize={42 * s} delay={4} /> : null}
            <Hero value={hours} unit="hrs" delay={COUNT_DELAY} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 * s }}>
              <Caption delay={30}>{caption}</Caption>
              <Caption delay={36} size={40} dim>
                {plural(totals.sessions, "session")} · {num(totals.activeDays)} active {totals.activeDays === 1 ? "day" : "days"}
              </Caption>
            </div>
          </div>
        }
        secondary={<Timeline />}
      />
    </TapeCard>
  );
};
