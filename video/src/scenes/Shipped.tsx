// Scene "shipped": what actually reached your main branches. The share of
// commits made with AI is the giant number; top repos print as `git log`
// style output with a meter of AI commits, then the period's diff in
// green / red, the biggest ship day, and GitHub numbers if the user ran
// with --github.
//
// Handles "nothing shipped" (no repos or 0 commits) with a friendly line.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Appear } from "../components/Appear";
import { countProgress } from "../components/CountUp";
import { num, plural, shortDay } from "../components/format";
import { Caption, Hero } from "../components/Hero";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { terminalInner, TermList } from "../tape/TermList";
import { TerminalWindow, TypedPrompt } from "../tape/Terminal";

// When the +added / −removed line prints (frames into the scene).
const DIFF_AT = 44;

const Repos: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The diff counts up like `git diff --stat` crunching, landing on the real totals.
  const diff = countProgress(frame, fps, DIFF_AT);
  const { props, theme, font, s, name, wide } = useRecap();
  const width = useSlotWidth();
  const shipped = props.stats.shipped;
  const repos = shipped?.byRepo.slice(0, 3) ?? [];
  const max = Math.max(...repos.map((r) => r.commits), 1);
  const rows = repos.map((r) => ({
    key: r.name,
    name: name(r.name),
    value: plural(r.commits, "commit"),
    // The "with AI" line only fits in wide; vertical drops it to save space.
    sub: wide ? `${num(r.aiCommits)} with AI` : undefined,
    meter: r.commits / max,
  }));
  return (
    <TerminalWindow title="~/repos — git" width={width} delay={6}>
      <TypedPrompt command="git log --author=me --ai" fontSize={36 * s} delay={10} />
      <div style={{ marginTop: 26 * s }}>
        <TermList rows={rows} width={terminalInner(width, s)} nameSize={52} empty="(no commits on main yet)" />
      </div>
      {shipped && (shipped.linesAdded > 0 || shipped.linesRemoved > 0) ? (
        // The diff, in git's colors, as the last line of output.
        <Appear delay={DIFF_AT}>
          <div
            style={{
              marginTop: 28 * s,
              paddingTop: 22 * s,
              borderTop: `${3 * s}px dashed #343434`,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              columnGap: 24 * s,
              fontWeight: font.black,
              fontSize: 60 * s,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ color: theme.add }}>+{num(Math.round(shipped.linesAdded * diff))}</span>
            <span style={{ color: theme.del }}>−{num(Math.round(shipped.linesRemoved * diff))}</span>
            <span style={{ fontSize: 32 * s, fontWeight: 700, color: theme.panelDim, letterSpacing: 0 }}>lines</span>
          </div>
        </Appear>
      ) : null}
    </TerminalWindow>
  );
};

export const Shipped: React.FC = () => {
  const { props, s } = useRecap();
  const shipped = props.stats.shipped;
  const hasCommits = !!shipped && shipped.commits > 0;
  const percent = hasCommits ? Math.round(shipped!.aiShare * 100) : 0;
  const caption =
    props.story.captions.shipped ??
    (hasCommits ? `${num(shipped!.aiCommits)} of ${plural(shipped!.commits, "commit")} made with AI.` : "Nothing reached main yet. The tape's still rolling.");
  const gh = shipped?.github;

  return (
    <TapeCard>
      <Stage
        scene="shipped"
        tapeSubtitle="SHIPPED"
        primaryShare={0.46}
        primary={
          <div style={{ display: "flex", flexDirection: "column", gap: 26 * s }}>
            {hasCommits ? <Hero value={percent} unit="%" tightUnit maxSize={260} share={0.5} /> : <Hero value={0} unit="commits" maxSize={260} share={0.3} />}
            <Caption delay={30}>{caption}</Caption>
            {hasCommits && shipped!.biggestDay ? (
              <Caption delay={36} size={40} dim>
                Biggest ship day: {shortDay(shipped!.biggestDay.date)} · {plural(shipped!.biggestDay.commits, "commit")}
              </Caption>
            ) : null}
            {gh ? (
              <Caption delay={40} size={40} dim>
                {plural(gh.prsMerged, "PR")} merged · {plural(gh.releases, "release")} · +{num(gh.starsGained)} ★
              </Caption>
            ) : null}
          </div>
        }
        secondary={hasCommits ? <Repos /> : undefined}
      />
    </TapeCard>
  );
};
