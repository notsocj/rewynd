// Scene "projects": your top projects by time, printed like a directory
// listing, with Claude's one-line summary under the top three as code
// comments ("# auth, auth, and more auth").
//
// Names respect prefs.hideProjectNames ("Project A/B/C"), and long names
// truncate with "…".

import React from "react";
import { AGENT_LABELS } from "../../../contract/recap";
import { duration, plural } from "../components/format";
import { Caption, HeroText } from "../components/Hero";
import { useRecap } from "../recap/context";
import { Stage, useSlotWidth } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { terminalInner, TermList } from "../tape/TermList";
import { TerminalWindow, TypedPrompt } from "../tape/Terminal";

const List: React.FC = () => {
  const { props, s, name, text, wide } = useRecap();
  const width = useSlotWidth();
  const lines = new Map(props.story.projects.map((p) => [p.name, p.line]));
  const rows = props.stats.projects.slice(0, wide ? 5 : 4).map((p) => ({
    key: p.name,
    name: name(p.name),
    value: duration(p.minutes),
    sub: `${plural(p.sessions, "session")} · ${p.agents.map((a) => AGENT_LABELS[a]).join(" + ")}`,
    comment: lines.has(p.name) ? text(lines.get(p.name)!) : undefined,
  }));
  return (
    <TerminalWindow title="~/projects — zsh" width={width} delay={6}>
      <TypedPrompt command="ls ~/projects --by-time" fontSize={36 * s} delay={10} />
      <div style={{ marginTop: 26 * s }}>
        <TermList rows={rows} width={terminalInner(width, s)} nameSize={54} empty="(no projects found)" />
      </div>
    </TerminalWindow>
  );
};

export const Projects: React.FC = () => {
  const { props, s, name, text } = useRecap();
  const top = props.stats.projects[0];
  const count = props.stats.projects.length;
  const caption = props.story.captions.projects ?? (count > 1 ? `Your #1 out of ${count} projects.` : "Your one and only.");

  return (
    <TapeCard>
      <Stage
        scene="projects"
        tapeSubtitle="TOP PROJECTS"
        primaryShare={0.42}
        primary={
          top ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 * s }}>
              <HeroText text={name(top.name)} maxSize={130} share={1} />
              <Caption delay={26}>{text(caption)}</Caption>
            </div>
          ) : (
            <Caption delay={10}>No projects on this tape yet.</Caption>
          )
        }
        secondary={<List />}
      />
    </TapeCard>
  );
};
