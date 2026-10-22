// The real outputs of the template:
// - <Rewynd>: the full video. Plays props.scenes in order; every scene
//   starts with the rewind glitch. Adds the user's music if they gave one.
// - <RewyndCard>: the share card, one still image of the outro summary
//   (its last frame, once everything has animated in).
// - <RewyndScene>: one carousel slide, a still of any scene at its settled
//   frame. scripts/render.ts renders one per scene for Instagram / X.
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
import type { RecapProps, SceneId } from "../../contract/recap";
import { RecapProvider } from "./recap/context";
import { SCENES, sceneFrames, settledFrame, totalFrames } from "./scenes/registry";
import { StillContext } from "./components/still";
import type { RewyndSceneProps, SingleSceneProps } from "./schema";
import { CameraContext, seedOf } from "./tape/Camera";
import { SceneIdContext } from "./templates/frame";
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

export const calculateSlideMetadata: CalculateMetadataFunction<RewyndSceneProps> = ({ props }) => sizeFor(props.prefs.format);

export const calculateSingleMetadata: CalculateMetadataFunction<SingleSceneProps> = ({ props }) => ({
  durationInFrames: sceneFrames(props.scene),
  ...sizeFor(props.recap.prefs.format),
});

export const Rewynd: React.FC<RecapProps> = (props) => {
  return (
    <RecapProvider props={props}>
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <Series>
          {props.scenes.map((id, i) => {
            const Scene = SCENES[id].component;
            const frames = sceneFrames(id);
            return (
              <Series.Sequence key={id} durationInFrames={frames} name={id}>
                {/* The camcorder drift is on in the video (off on the share card). */}
                <CameraContext.Provider value={{ on: true, sceneFrames: frames, seed: seedOf(id) }}>
                  {/* Different seed per scene so each glitch looks different.
                      The first scene starts with PLAY; the last one ends with
                      the CRT switch-off instead of a tracking slip. */}
                  <RewindGlitch seed={id} sceneFrames={frames} first={i === 0} last={i === props.scenes.length - 1}>
                    <SceneIdContext.Provider value={id}>
                      <Scene />
                    </SceneIdContext.Provider>
                  </RewindGlitch>
                </CameraContext.Provider>
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

/**
 * One scene frozen at its settled frame (see settledFrame), with no rewind
 * glitch, the camera off (a still is never caught mid-tilt) and anything
 * that blinks held on.
 * A still only has frame 0, so <Freeze> can't reach a later frame; instead a
 * Sequence that "started" N frames ago makes frame 0 read as frame N inside
 * the scene.
 */
const SettledScene: React.FC<{ scene: SceneId }> = ({ scene }) => {
  const Scene = SCENES[scene].component;
  return (
    <StillContext.Provider value={true}>
      <Sequence from={-settledFrame(scene)}>
        <SceneIdContext.Provider value={scene}>
          <Scene />
        </SceneIdContext.Provider>
      </Sequence>
    </StillContext.Provider>
  );
};

export const RewyndCard: React.FC<RecapProps> = (props) => (
  <RecapProvider props={props}>
    <SettledScene scene="outro" />
  </RecapProvider>
);

export const RewyndScene: React.FC<RewyndSceneProps> = ({ scene, ...recap }) => (
  <RecapProvider props={recap}>
    <SettledScene scene={scene} />
  </RecapProvider>
);

export const SingleScene: React.FC<SingleSceneProps> = ({ recap, scene }) => {
  const Scene = SCENES[scene].component;
  const frames = sceneFrames(scene);
  return (
    <RecapProvider props={recap}>
      <CameraContext.Provider value={{ on: true, sceneFrames: frames, seed: seedOf(scene) }}>
        <RewindGlitch seed={scene} sceneFrames={frames}>
          <SceneIdContext.Provider value={scene}>
            <Scene />
          </SceneIdContext.Provider>
        </RewindGlitch>
      </CameraContext.Provider>
    </RecapProvider>
  );
};
