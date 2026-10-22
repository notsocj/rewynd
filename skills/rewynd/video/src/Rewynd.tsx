// The real outputs of the template:
// - <Rewynd>: the full video. Plays props.scenes in order: the first scene
//   starts with the rewind glitch, every other scene morphs in through a
//   transition (transitions/), and the last one ends with the CRT
//   switch-off. Adds the user's music if they gave one.
// - <RewyndCard>: the share card, one still image of the outro summary
//   (its last frame, once everything has animated in).
// - <RewyndScene>: one carousel slide, a still of any scene at its settled
//   frame. scripts/render.ts renders one per scene for Instagram / X.
//
// Plus <SingleScene>, used by the Samples folder in Studio to preview one
// scene at a time.
//
// The video's length and size aren't fixed: calculateRecapMetadata() works
// them out from the props before rendering (duration = the scenes minus the
// transition overlaps, see transitions/timeline.ts; size from prefs.format).

import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Freeze, Sequence, staticFile, type CalculateMetadataFunction } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import type { RecapProps, SceneId } from "../../contract/recap";
import { RecapProvider, useRecap } from "./recap/context";
import { SCENES, sceneFrames, settledFrame } from "./scenes/registry";
import { EASE_IN_OUT } from "./components/motion";
import { getTheme, resolveTheme, type Theme } from "./theme";
import { buildTimeline, type TimelineStep } from "./transitions/timeline";
import { colorMorph, pixelDissolve, push, tapeRoll } from "./transitions/presentations";
import { StillContext } from "./components/still";
import type { RewyndSceneProps, SingleSceneProps } from "./schema";
import { CameraContext, seedOf } from "./tape/Camera";
import { SceneIdContext } from "./templates/frame";
import { RewindGlitch } from "./tape/RewindGlitch";

// "vertical" → 1080×1920, "wide" → 1920×1080. "both" is split into two
// renders by scripts/render.ts; if it reaches us anyway, render vertical.
export const sizeFor = (format: RecapProps["prefs"]["format"]) =>
  format === "wide" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };

/** The template the props will render with (needed to plan the transitions). */
const themeFor = (props: RecapProps) => {
  const pick = resolveTheme(props.prefs.theme, props.prefs.accent, props.story.personality.id);
  return getTheme(pick.theme, pick.accent);
};

export const calculateRecapMetadata: CalculateMetadataFunction<RecapProps> = ({ props }) => ({
  durationInFrames: buildTimeline(props.scenes, themeFor(props).template).total,
  ...sizeFor(props.prefs.format),
});

export const calculateCardMetadata: CalculateMetadataFunction<RecapProps> = ({ props }) => sizeFor(props.prefs.format);

export const calculateSlideMetadata: CalculateMetadataFunction<RewyndSceneProps> = ({ props }) => sizeFor(props.prefs.format);

export const calculateSingleMetadata: CalculateMetadataFunction<SingleSceneProps> = ({ props }) => ({
  durationInFrames: sceneFrames(props.scene),
  ...sizeFor(props.recap.prefs.format),
});

/** The transition INTO a scene, in the voice of the template. */
const presentationFor = (step: TimelineStep, theme: Theme) => {
  if (step.join?.kind === "morph") {
    // The morph disc uses the accent; on the receipt the accent is the paper
    // field itself, so the stamp red is used instead (arcade: magenta).
    const color = theme.template === "receipt" ? theme.stamp : theme.template === "arcade" ? theme.pink : theme.accent;
    return colorMorph({ color, at: "50% 42%" });
  }
  switch (theme.template) {
    case "terminal":
      return push(0);
    case "receipt":
      return push(3);
    case "arcade":
      return pixelDissolve({ color: theme.bg, seed: step.id });
    default:
      return tapeRoll(step.id);
  }
};

const Timeline: React.FC<{ scenes: SceneId[] }> = ({ scenes }) => {
  const { theme } = useRecap();
  const { steps } = buildTimeline(scenes, theme.template);
  return (
    <TransitionSeries>
      {steps.map((step, i) => {
        const Scene = SCENES[step.id].component;
        const scene = (
          // The camcorder drift is on in the video (off on the share card).
          <CameraContext.Provider value={{ on: true, sceneFrames: step.duration, seed: seedOf(step.id) }}>
            {/* Only the first scene plays the rewind glitch (with ▶); only the
                last ends with the CRT switch-off. Everything in between is
                handled by the transitions. */}
            <RewindGlitch seed={step.id} sceneFrames={step.duration} first={i === 0} last={i === steps.length - 1} enter={i === 0} slip={false}>
              <SceneIdContext.Provider value={step.id}>
                <Scene />
              </SceneIdContext.Provider>
            </RewindGlitch>
          </CameraContext.Provider>
        );
        return (
          <React.Fragment key={step.id}>
            {step.join ? (
              <TransitionSeries.Transition
                presentation={presentationFor(step, theme)}
                // The morph shapes its own two phases (cover, then reveal), so it
                // gets linear progress; the others ease in and out as one move.
                timing={linearTiming({ durationInFrames: step.join.frames, easing: step.join.kind === "morph" ? undefined : EASE_IN_OUT })}
              />
            ) : null}
            <TransitionSeries.Sequence durationInFrames={step.duration} name={step.id}>
              {step.hold > 0 ? (
                // Hold the scene on its first frame while it's being revealed:
                // Freeze pins the time at `hold` (= the scene's frame 0 inside
                // the Sequence below) until the reveal is under way.
                <Freeze frame={step.hold} active={(f) => f < step.hold}>
                  <Sequence from={step.hold}>{scene}</Sequence>
                </Freeze>
              ) : (
                scene
              )}
            </TransitionSeries.Sequence>
          </React.Fragment>
        );
      })}
    </TransitionSeries>
  );
};

export const Rewynd: React.FC<RecapProps> = (props) => {
  return (
    <RecapProvider props={props}>
      {/* The template's own background behind everything, so a tilted or
          moving card in a transition never shows black corners. */}
      <AbsoluteFill style={{ backgroundColor: themeFor(props).bg }}>
        <Timeline scenes={props.scenes} />
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
