// Scene "tools": what the agents did most for you, as terminal output with a
// level meter per tool. Tool names are agent-neutral ("Edit files",
// "Run commands") from TOOL_LABELS, because the recap merges several agents
// that each name their tools differently.

import React from "react";
import { TOOL_LABELS } from "../../../contract/recap";
import { num } from "../components/format";
import { Caption } from "../components/Hero";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { terminalInner, TermList } from "../tape/TermList";
import { TerminalWindow, TypedPrompt } from "../tape/Terminal";

const List: React.FC = () => {
  const { props, s } = useRecap();
  const width = useSlotWidth();
  const tools = props.stats.tools.slice(0, 5);
  const max = Math.max(...tools.map((t) => t.count), 1);
  const rows = tools.map((t) => ({
    key: t.category,
    name: TOOL_LABELS[t.category] ?? t.label,
    value: num(t.count),
    meter: t.count / max,
  }));
  return (
    <TerminalWindow title="~/rewynd — zsh" width={width} delay={6}>
      <TypedPrompt command="rewynd tools --top 5" fontSize={36 * s} delay={10} />
      <div style={{ marginTop: 26 * s }}>
        <TermList rows={rows} width={terminalInner(width, s)} empty="(no tool calls recorded)" />
      </div>
    </TerminalWindow>
  );
};

export const Tools: React.FC = () => {
  const { props, font, theme, s } = useRecap();
  const total = props.stats.totals.toolCalls;
  const top = props.stats.tools[0];
  const caption =
    props.story.captions.tools ?? (top ? `Mostly: ${(TOOL_LABELS[top.category] ?? top.label).toLowerCase()}.` : "No tool breakdown on this tape.");

  return (
    <TapeCard>
      <Stage
        scene="tools"
        tapeSubtitle="TOP TOOLS"
        primaryShare={0.4}
        primary={
          <div style={{ display: "flex", flexDirection: "column", gap: 12 * s }}>
            <Caption delay={4} size={60}>
              <span style={{ fontWeight: font.black, color: theme.accent }}>{num(total)}</span> tool calls.
            </Caption>
            <Caption delay={12} size={44} dim>
              {caption}
            </Caption>
          </div>
        }
        secondary={<List />}
      />
    </TapeCard>
  );
};
