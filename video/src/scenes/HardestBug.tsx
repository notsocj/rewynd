// Scene "hardestBug": the session with the most back-and-forth on one
// problem, told as a test run: a red FAIL line with the project, Claude's
// one-line summary of the bug, then (a beat later) a green "fixed" line.
//
// If there was no hardest bug, the terminal just reports a suspicious
// all-green run.

import React from "react";
import { Appear } from "../components/Appear";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { TerminalWindow, TypedPrompt } from "../tape/Terminal";
import { ellipsis } from "../components/Appear";

const Run: React.FC = () => {
  const { props, theme, font, s, name, text } = useRecap();
  const width = useSlotWidth();
  const bug = props.story.hardestBug;
  const status: React.CSSProperties = { fontSize: 40 * s, fontWeight: 900, letterSpacing: "0.02em", ...ellipsis };

  return (
    <TerminalWindow title="~/rewynd — test" width={width} delay={4}>
      <TypedPrompt command="npm test" fontSize={36 * s} delay={8} />
      <div style={{ marginTop: 30 * s, display: "flex", flexDirection: "column", gap: 30 * s }}>
        {bug ? (
          <>
            <Appear delay={20}>
              <div style={{ ...status, color: theme.del }}>✗ FAIL{bug.project ? `  ${name(bug.project)}` : ""}</div>
            </Appear>
            <Appear delay={28} distance={20}>
              <div style={{ fontSize: 60 * s, fontWeight: font.black, letterSpacing: "-0.03em", lineHeight: 1.1, overflowWrap: "anywhere" }}>
                {text(bug.line)}
              </div>
            </Appear>
            <Appear delay={58}>
              <div style={{ ...status, color: theme.add }}>✓ PASS  fixed. eventually.</div>
            </Appear>
          </>
        ) : (
          <Appear delay={20}>
            <div style={{ ...status, color: theme.add, whiteSpace: "normal" }}>✓ PASS  no bug worth mentioning. Suspicious.</div>
          </Appear>
        )}
      </div>
    </TerminalWindow>
  );
};

const Headline: React.FC = () => {
  const { props, theme, s, font } = useRecap();
  return (
    <Appear delay={6}>
      <div style={{ fontSize: 60 * s, fontWeight: font.black, letterSpacing: "-0.03em", lineHeight: 1.05, textShadow: theme.osdShadow }}>
        {props.story.captions.hardestBug ?? "The one that fought back."}
      </div>
    </Appear>
  );
};

export const HardestBug: React.FC = () => (
  <TapeCard>
    <Stage scene="hardestBug" tapeSubtitle="HARDEST BUG" primaryShare={0.32} primary={<Headline />} secondary={<Run />} />
  </TapeCard>
);
