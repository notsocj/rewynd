// Scene "funny": the blooper reel. Claude's funny lines (every number in
// them comes from stats.json) print one by one inside a terminal, like
// output scrolling past. The background-runs joke ("Codex double-checked
// itself 702 times") prints last, as a background job.
//
// If Claude wrote no lines, it falls back to lines built from the phrase
// counts, so the scene is never empty.

import React from "react";
import { Appear } from "../components/Appear";
import { plural } from "../components/format";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { TerminalWindow, TypedPrompt } from "../tape/Terminal";

const Lines: React.FC = () => {
  const { props, theme, font, s, text } = useRecap();
  const width = useSlotWidth();
  const { phrases } = props.stats;

  const fallback = [
    phrases.stillBroken > 0 ? `You said “still broken” ${plural(phrases.stillBroken, "time")}.` : null,
    phrases.please > 0 ? `You said please ${plural(phrases.please, "time")}.` : null,
    phrases.why > 0 ? `You asked “why” ${plural(phrases.why, "time")}.` : null,
  ].filter((l): l is string => !!l);
  const lines = (props.story.funnyLines.length ? props.story.funnyLines : fallback).slice(0, 3);
  const background = props.story.backgroundLine;

  return (
    <TerminalWindow title="~/rewynd — bloopers" width={width} delay={4}>
      <TypedPrompt command="rewynd bloopers" fontSize={36 * s} delay={8} />
      <div style={{ marginTop: 30 * s, display: "flex", flexDirection: "column", gap: 30 * s }}>
        {lines.length === 0 ? (
          <Appear delay={22}>
            <div style={{ fontSize: 44 * s, fontWeight: 700, color: theme.panelDim }}>(a clean take, no bloopers)</div>
          </Appear>
        ) : null}
        {lines.map((line, i) => (
          // Each line arrives ~0.6s after the previous one, so they can be read.
          <Appear key={i} delay={20 + i * 18} distance={20}>
            <div style={{ display: "flex", gap: 18 * s, fontSize: 56 * s, fontWeight: font.black, letterSpacing: "-0.025em", lineHeight: 1.12 }}>
              <span style={{ color: theme.accent === theme.del ? theme.amber : theme.accent, flexShrink: 0 }}>›</span>
              <span style={{ overflowWrap: "anywhere" }}>{text(line)}</span>
            </div>
          </Appear>
        ))}
        {background ? (
          <Appear delay={20 + lines.length * 18 + 6}>
            <div
              style={{
                paddingTop: 22 * s,
                borderTop: `${3 * s}px dashed #343434`,
                fontSize: 38 * s,
                fontWeight: 700,
                color: theme.panelDim,
              }}
            >
              <span style={{ color: theme.add }}>[bg]</span> {text(background)}
            </div>
          </Appear>
        ) : null}
      </div>
    </TerminalWindow>
  );
};

// The left column on wide gets a short headline; on vertical it sits under the label.
const Headline: React.FC = () => {
  const { props, theme, s, font } = useRecap();
  return (
    <Appear delay={6}>
      <div style={{ fontSize: 60 * s, fontWeight: font.black, letterSpacing: "-0.03em", lineHeight: 1.05, textShadow: theme.osdShadow }}>
        {props.story.captions.funny ?? "Caught on tape."}
      </div>
    </Appear>
  );
};

export const Funny: React.FC = () => (
  <TapeCard>
    <Stage scene="funny" tapeSubtitle="BLOOPER REEL" primaryShare={0.3} primary={<Headline />} secondary={<Lines />} />
  </TapeCard>
);
