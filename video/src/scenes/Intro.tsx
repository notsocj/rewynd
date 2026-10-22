// Scene "intro": the title card. A big tape label for the period, the
// headline ("Your October in AI coding"), the command that "starts" the
// recap, and which agents are on this tape (plain-text names, no logos).

import React from "react";
import { AGENT_LABELS } from "../../../contract/recap";
import { Appear } from "../components/Appear";
import { periodName } from "../components/format";
import { Caption } from "../components/Hero";
import { useRecap } from "../recap/context";
import { Stage } from "../tape/Stage";
import { TapeCard } from "../tape/TapeCard";
import { TapeLabel } from "../tape/TapeLabel";
import { TypedPrompt } from "../tape/Terminal";

export const Intro: React.FC = () => {
  const { props, theme, font, s, tapeNumber } = useRecap();
  const { stats, story } = props;
  const name = periodName(stats.period.kind, stats.period.label);
  const headline = story.captions.intro ?? `Your ${name} in AI coding`;
  const agents = stats.agents.map((a) => AGENT_LABELS[a]).join(" + ");

  return (
    <TapeCard>
      <Stage
        scene="intro"
        center
        primary={
          // alignItems flex-start keeps the tape label sticker its natural width
          // instead of stretching across the column.
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 56 * s }}>
            <TapeLabel title={stats.period.tapeLabel} subtitle={`TAPE ${tapeNumber("intro")} · REWYND`} size={1.1} />
            <Appear delay={10} distance={40}>
              <div
                style={{
                  fontSize: 132 * s,
                  fontWeight: font.black,
                  letterSpacing: "-0.045em",
                  lineHeight: 0.95,
                  textShadow: theme.osdShadow,
                  // Long custom headlines wrap instead of running off the card.
                  overflowWrap: "anywhere",
                }}
              >
                {headline}
              </div>
            </Appear>
            <TypedPrompt command={`rewynd --${stats.period.kind} ${name.toLowerCase()}`} fontSize={42 * s} delay={22} cursorAtEnd />
            {agents ? (
              <Caption delay={34} size={44} dim>
                On this tape: {agents}
              </Caption>
            ) : null}
          </div>
        }
      />
    </TapeCard>
  );
};
