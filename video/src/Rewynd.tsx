// The two real outputs of the template:
// - <Rewynd>: the full video. Plays props.scenes in order; every scene
//   starts with the rewind glitch. Adds the user's music if they gave one.
// - <RewyndCard>: the share card, one still image of the outro summary
//   (its last frame, once everything has animated in).
//
// Plus <SingleScene>, used by the Samples folder in Studio to preview one
// scene at a time.
//
// The video's length and size aren't fixed: calculateRecapMetadata() works
// them out from the props before rendering (duration = sum of the chosen
// scenes; size from prefs.format).

import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, Series, staticFile, type CalculateMetadataFunction } from "remotion";
import type { RecapProps } from "../../contract/recap";
import { RecapProvider } from "./recap/context";
import { SCENES, sceneFrames, totalFrames } from "./scenes/registry";
import type { SingleSceneProps } from "./schema";
import { RewindGlitch } from "./tape/RewindGlitch";

// "vertical" → 1080×1920, "wide" → 1920×1080. "both" is split into two
// renders by scripts/render.ts; if it reaches us anyway, render vertical.
export const sizeFor = (format: RecapProps["prefs"]["format"]) =>
  format === "wide" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };

export const calculateRecapMetadata: CalculateMetadataFunction<RecapProps> = ({ props }) => ({
  durationInFrames: totalFrames(props.scenes),
  ...sizeFor(props.prefs.format),
});

export const calculateCardMetadata: CalculateMetadataFunction<RecapProps> = ({ props }) => sizeFor(props.prefs.format);

export const calculateSingleMetadata: CalculateMetadataFunction<SingleSceneProps> = ({ props }) => ({
  durationInFrames: sceneFrames(props.scene),
  ...sizeFor(props.recap.prefs.format),
});

export const Rewynd: React.FC<RecapProps> = (props) => {
  return (
    <RecapProvider props={props}>
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <Series>
          {props.scenes.map((id) => {
            const Scene = SCENES[id].component;
            return (
              <Series.Sequence key={id} durationInFrames={sceneFrames(id)} name={id}>
                {/* Different seed per scene so each glitch looks different. */}
                <RewindGlitch seed={id}>
                  <Scene />
                </RewindGlitch>
              </Series.Sequence>
            );
          })}
        </Series>
        {/* The user's own music, if any. We never ship music ourselves. */}
        {props.musicStaticPath ? <Audio src={staticFile(props.musicStaticPath)} /> : null}
      </AbsoluteFill>
    </RecapProvider>
  );
};

export const RewyndCard: React.FC<RecapProps> = (props) => {
  const Outro = SCENES.outro.component;
  return (
    <RecapProvider props={props}>
      {/* Show the outro's last frame, when everything has animated in.
          A still only has frame 0, so <Freeze> can't reach a later frame;
          instead a Sequence that "started" N-1 frames ago makes frame 0 of
          the still read as frame N-1 inside the outro. */}
      <Sequence from={-(sceneFrames("outro") - 1)}>
        <Outro />
      </Sequence>
    </RecapProvider>
  );
};

export const SingleScene: React.FC<SingleSceneProps> = ({ recap, scene }) => {
  const Scene = SCENES[scene].component;
  return (
    <RecapProvider props={recap}>
      <RewindGlitch seed={scene}>
        <Scene />
      </RewindGlitch>
    </RecapProvider>
  );
};
