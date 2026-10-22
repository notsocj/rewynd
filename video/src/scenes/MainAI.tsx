// Scene "mainAI": which agent you used most, and how the time split between
// them. Agent names are plain text, never logos. The fun line comes from
// real switch counts ("You cheated on Claude Code with Codex 41 times").
//
// Works with any number of agents: with one, it becomes a "loyal" card.

import React from "react";
import { AGENT_LABELS } from "../../../contract/recap";
import { periodName, plural } from "../components/format";
import { Caption, Hero } from "../components/Hero";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { terminalInner, TermList } from "../tape/TermList";
import { TerminalWindow, TypedPrompt } from "../tape/Terminal";
import { duration } from "../components/format";

const Shares: React.FC = () => {
  const { props, s } = useRecap();
  const width = useSlotWidth();
  const { agentShare, byAgent } = props.stats;
  const top = Math.max(...agentShare.map((a) => a.share), 0.0001);
  const rows = agentShare.slice(0, 5).map((a) => ({
    key: a.agent,
    name: AGENT_LABELS[a.agent] ?? a.agent,
    value: `${a.percent}%`,
    sub: byAgent[a.agent] ? `${plural(byAgent[a.agent]!.sessions, "session")} · ${duration(byAgent[a.agent]!.activeMinutes)}` : undefined,
    meter: a.share / top,
  }));
  return (
    <TerminalWindow title="~/rewynd — agents" width={width} delay={6}>
      <TypedPrompt command="rewynd agents --share" fontSize={36 * s} delay={10} />
      <div style={{ marginTop: 26 * s }}>
        <TermList rows={rows} width={terminalInner(width, s)} empty="(no agents found)" />
      </div>
    </TerminalWindow>
  );
};

export const MainAI: React.FC = () => {
  const { props, s } = useRecap();
  const { stats, story } = props;
  const main = stats.mainAgent;
  const mainShare = stats.agentShare.find((a) => a.agent === main);
  const sw = stats.agentSwitches;

  // The fun line, from real counts only. Claude's caption wins if it wrote one.
  const line =
    story.captions.mainAI ??
    (sw.topSwitch && sw.topSwitch.count > 0
      ? `You cheated on ${AGENT_LABELS[sw.topSwitch.from]} with ${AGENT_LABELS[sw.topSwitch.to]} ${plural(sw.topSwitch.count, "time")}.`
      : stats.agents.length > 1
        ? `${plural(sw.sameDay, "day")} with 2+ agents.`
        : `Loyal to one AI all ${stats.period.kind === "month" ? periodName(stats.period.kind, stats.period.label) : "year"}.`);

  return (
    <TapeCard>
      <Stage
        scene="mainAI"
        tapeSubtitle="YOUR MAIN AI"
        primary={
          <div style={{ display: "flex", flexDirection: "column", gap: 28 * s }}>
            {mainShare ? <Hero value={mainShare.percent} unit="%" tightUnit maxSize={260} share={0.5} /> : null}
            <Caption delay={26} size={60}>
              <span style={{ fontWeight: 900 }}>{main ? AGENT_LABELS[main] : "No agent yet"}</span>
              {main ? " was your main AI." : ""}
            </Caption>
            <Caption delay={34} size={44} dim>
              {line}
            </Caption>
          </div>
        }
        secondary={<Shares />}
      />
    </TapeCard>
  );
};
