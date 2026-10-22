// Scene "hardestBug": the session with the most back-and-forth on one
// problem, told as a test run: a red FAIL line with the project, Claude's
// one-line summary of the bug, then (a beat later) a green "fixed" line.
//
// If there was no hardest bug, the terminal just reports a suspicious
// all-green run.

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Appear, Words } from "../components/Appear";
import { CLAMP, EASE_OUT } from "../components/motion";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { TerminalWindow, TypedPrompt } from "../tape/Terminal";
import { ellipsis } from "../components/Appear";

// When things happen in the test run (frames into the scene).
const FAIL_AT = 20;
const PASS_AT = 58;

const Run: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, theme, font, s, name, text } = useRecap();
  // FAIL shakes side to side as it prints, dying out over ~0.4s: the test
  // run "rejecting" the code.
  const shakeT = frame - FAIL_AT;
  const shake = shakeT >= 0 && shakeT < 12 ? 14 * s * Math.sin(shakeT * 2.6) * (1 - shakeT / 12) : 0;
  // When PASS prints, a strike-through draws across the bug line, left to
  // right: the bug is crossed off.
  const strike = interpolate(frame, [PASS_AT + 4, PASS_AT + 14], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const width = useSlotWidth();
  const bug = props.story.hardestBug;
  const status: React.CSSProperties = { fontSize: 40 * s, fontWeight: 900, letterSpacing: "0.02em", ...ellipsis };

  return (
    <TerminalWindow title="~/rewynd — test" width={width} delay={4}>
      <TypedPrompt command="npm test" fontSize={36 * s} delay={8} />
      <div style={{ marginTop: 30 * s, display: "flex", flexDirection: "column", gap: 30 * s }}>
        {bug ? (
          <>
            <Appear delay={FAIL_AT}>
              <div style={{ ...status, color: theme.del, translate: `${shake}px 0` }}>✗ FAIL{bug.project ? `  ${name(bug.project)}` : ""}</div>
            </Appear>
            <Appear delay={28} distance={20}>
              <div style={{ position: "relative", fontSize: 60 * s, fontWeight: font.black, letterSpacing: "-0.03em", lineHeight: 1.1, overflowWrap: "anywhere" }}>
                <span style={{ opacity: interpolate(strike, [0, 1], [1, 0.55]) }}>{text(bug.line)}</span>
                {/* The strike-through: a diff-red bar grown from the left. */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    height: 7 * s,
                    background: theme.del,
                    scale: `${strike} 1`,
                    transformOrigin: "left center",
                  }}
                />
              </div>
            </Appear>
            <Appear delay={PASS_AT}>
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
    <div style={{ fontSize: 60 * s, fontWeight: font.black, letterSpacing: "-0.03em", lineHeight: 1.05, textShadow: theme.osdShadow }}>
      <Words
        delay={6}
        text={props.story.captions.hardestBug ?? "The one that fought back."}
      />
    </div>
  );
};

export const HardestBug: React.FC = () => (
  <TapeCard>
    <Stage scene="hardestBug" tapeSubtitle="HARDEST BUG" primaryShare={0.32} primary={<Headline />} secondary={<Run />} />
  </TapeCard>
);
