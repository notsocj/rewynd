// Zod schemas for what the compositions accept as props.
//
// The real shape of the props lives in contract/recap.ts (shared with the
// scripts that write props.json). This file mirrors it for two reasons:
// 1. Remotion Studio reads a zod schema to show editable controls in its
//    side panel, which is how you try themes / formats while previewing.
// 2. Validating props.json before rendering turns a broken file into a
//    clear error instead of a half-broken video.
//
// It's deliberately loose for the big nested objects (stats, story):
// `z.custom` trusts the contract's TypeScript types there, and the scripts
// already validate story.json before rendering. The top-level fields, which
// a person is likely to edit by hand, are checked properly.

import { z } from "zod";
import type { RecapProps, SceneId, Stats, Story } from "../../contract/recap";
import { SCENE_ORDER } from "../../contract/recap";

// z.enum needs a non-empty tuple, so cast the contract's array once.
const sceneIds = SCENE_ORDER as [SceneId, ...SceneId[]];

export const designPrefsSchema = z.object({
  // A template id from themes.json ("tape", "terminal", "receipt", "arcade"),
  // or "auto" (picked from the personality).
  theme: z.string(),
  // One of that template's accent ids, or null for its first accent.
  accent: z.string().nullable(),
  font: z.union([
    z.object({ kind: z.literal("inter") }),
    z.object({ kind: z.literal("custom"), file: z.string() }),
  ]),
  // "both" is rendered twice by scripts/render.ts, once per size. If a
  // "both" ever reaches the video, it renders vertical.
  format: z.enum(["vertical", "wide", "both"]),
  hideProjectNames: z.boolean(),
  musicFile: z.string().nullable(),
});

export const recapSchema = z.object({
  stats: z.custom<Stats>((v) => typeof v === "object" && v !== null && "period" in v, {
    message: "stats must be the object from output/stats.json",
  }),
  story: z.custom<Story>((v) => typeof v === "object" && v !== null && "personality" in v, {
    message: "story must be the object from output/story.json",
  }),
  prefs: designPrefsSchema,
  scenes: z.array(z.enum(sceneIds)),
  repoUrl: z.string(),
  customFontStaticPath: z.string().nullable(),
  musicStaticPath: z.string().nullable(),
});

// Compile-time check that the schema and the contract agree: if the
// contract gains or renames a top-level field, this line stops compiling.
type SchemaMatchesContract = z.infer<typeof recapSchema> extends RecapProps
  ? RecapProps extends z.infer<typeof recapSchema>
    ? true
    : never
  : never;
export const schemaMatchesContract: SchemaMatchesContract = true;

// A single-scene preview (Samples folder): the full recap plus which scene.
export const singleSceneSchema = z.object({
  recap: recapSchema,
  scene: z.enum(sceneIds),
});

export type SingleSceneProps = z.infer<typeof singleSceneSchema>;

// One carousel slide (RewyndScene): props.json plus which scene to show.
// Flat, not nested like the preview above, so scripts/render.ts only adds
// one field to the props it already wrote.
export const rewyndSceneSchema = recapSchema.extend({
  scene: z.enum(sceneIds),
});

export type RewyndSceneProps = z.infer<typeof rewyndSceneSchema>;

// Dev-only: puts up to four rendered stills side by side so design versions
// can be compared in one image. Paths are inside video/public/.
export const compareSchema = z.object({
  title: z.string(),
  panels: z.array(z.object({ file: z.string(), label: z.string() })).min(1).max(4),
});

export type CompareProps = z.infer<typeof compareSchema>;
