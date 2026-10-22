// Lists every composition this template can render. Remotion Studio shows
// them in its sidebar, and `npx remotion render/still <id>` picks one by id.
//
// The real ones are `Rewynd` (the video), `RewyndCard` (the share image) and
// `RewyndScene` (one carousel slide). scripts/render.ts renders them with
// --props=output/props.json (plus a `scene` for the slides).
// Their default props are the fake October fixture, so Studio has something
// to show; real renders always pass their own props.
//
// The Samples folder previews one scene at a time (vertical and wide) so
// each scene can be checked on its own.

import React from "react";
import { Composition, Folder, Still } from "remotion";
import { SCENE_ORDER } from "../../contract/recap";
import { edgeProps, edgeWideProps } from "./fixtures/edge";
import { octoberProps } from "./fixtures/october";
import {
  calculateCardMetadata,
  calculateRecapMetadata,
  calculateSingleMetadata,
  calculateSlideMetadata,
  Rewynd,
  RewyndCard,
  RewyndScene,
  SingleScene,
} from "./Rewynd";
import { Compare } from "./scenes/Compare";
import { FPS } from "./scenes/registry";
import { compareSchema, recapSchema, rewyndSceneSchema, singleSceneSchema } from "./schema";
// Importing this file starts loading the fonts before anything renders.
import "./fonts";

// The fixture in wide format, for the wide samples.
const octoberWide = { ...octoberProps, prefs: { ...octoberProps.prefs, format: "wide" as const } };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Rewynd"
        component={Rewynd}
        schema={recapSchema}
        calculateMetadata={calculateRecapMetadata}
        // Placeholders: calculateMetadata replaces all three from the props.
        durationInFrames={300}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={octoberProps}
      />
      <Still
        id="RewyndCard"
        component={RewyndCard}
        schema={recapSchema}
        calculateMetadata={calculateCardMetadata}
        width={1080}
        height={1920}
        defaultProps={octoberProps}
      />
      {/* A one-frame Composition, not a <Still>: a Still runs at 1 fps, and
          the slides should match the video's 30 fps frame exactly. */}
      <Composition
        id="RewyndScene"
        component={RewyndScene}
        schema={rewyndSceneSchema}
        calculateMetadata={calculateSlideMetadata}
        durationInFrames={1}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ ...octoberProps, scene: "hours" as const }}
      />

      <Folder name="Samples">
        <Composition
          id="Rewynd-wide"
          component={Rewynd}
          schema={recapSchema}
          calculateMetadata={calculateRecapMetadata}
          durationInFrames={300}
          fps={FPS}
          width={1920}
          height={1080}
          defaultProps={octoberWide}
        />
        {/* Stress tests: odd and extreme data (see fixtures/edge.ts). */}
        <Composition
          id="Rewynd-edge"
          component={Rewynd}
          schema={recapSchema}
          calculateMetadata={calculateRecapMetadata}
          durationInFrames={300}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={edgeProps}
        />
        <Composition
          id="Rewynd-edge-wide"
          component={Rewynd}
          schema={recapSchema}
          calculateMetadata={calculateRecapMetadata}
          durationInFrames={300}
          fps={FPS}
          width={1920}
          height={1080}
          defaultProps={edgeWideProps}
        />
        {/* One preview per scene, in both sizes. These are generated from
            the scene list on purpose: they're all the same template. */}
        {SCENE_ORDER.map((scene) => (
          <React.Fragment key={scene}>
            <Composition
              id={`Scene-${scene}`}
              component={SingleScene}
              schema={singleSceneSchema}
              calculateMetadata={calculateSingleMetadata}
              durationInFrames={120}
              fps={FPS}
              width={1080}
              height={1920}
              defaultProps={{ recap: octoberProps, scene }}
            />
            <Composition
              id={`Scene-${scene}-wide`}
              component={SingleScene}
              schema={singleSceneSchema}
              calculateMetadata={calculateSingleMetadata}
              durationInFrames={120}
              fps={FPS}
              width={1920}
              height={1080}
              defaultProps={{ recap: octoberWide, scene }}
            />
          </React.Fragment>
        ))}
      </Folder>

      {/* Every scene in every card template, vertical, for design review. */}
      <Folder name="Templates">
        {(["tape", "terminal", "receipt", "arcade"] as const).map((template) =>
          SCENE_ORDER.map((scene) => (
            <Composition
              key={`${template}-${scene}`}
              id={`T-${template}-${scene}`}
              component={SingleScene}
              schema={singleSceneSchema}
              calculateMetadata={calculateSingleMetadata}
              durationInFrames={120}
              fps={FPS}
              width={1080}
              height={1920}
              defaultProps={{ recap: { ...octoberProps, prefs: { ...octoberProps.prefs, theme: template, accent: null } }, scene }}
            />
          )),
        )}
        {(["tape", "terminal", "receipt", "arcade"] as const).map((template) =>
          SCENE_ORDER.map((scene) => (
            <Composition
              key={`${template}-${scene}-wide`}
              id={`T-${template}-${scene}-wide`}
              component={SingleScene}
              schema={singleSceneSchema}
              calculateMetadata={calculateSingleMetadata}
              durationInFrames={120}
              fps={FPS}
              width={1920}
              height={1080}
              defaultProps={{ recap: { ...octoberWide, prefs: { ...octoberWide.prefs, theme: template, accent: null } }, scene }}
            />
          )),
        )}
      </Folder>

      <Folder name="Dev">
        {/* Side-by-side stills for design reviews (images in public/compare/). */}
        <Composition
          id="Compare"
          component={Compare}
          schema={compareSchema}
          durationInFrames={1}
          fps={FPS}
          width={2280}
          height={1460}
          defaultProps={{
            title: "Hours",
            panels: [
              { file: "compare/HeroStat-classic.png", label: "v1 · Wrapped style" },
              { file: "compare/Hours-night.png", label: "v2 · Night" },
              { file: "compare/Hours-bluescreen.png", label: "v2 · Blue screen" },
            ],
          }}
        />
      </Folder>
    </>
  );
};
