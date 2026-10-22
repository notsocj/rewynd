// Which component plays each scene, and for how long.
//
// The contract (contract/recap.ts) defines the scene ids and their order;
// this file is the video's side of that: id → component + duration. The
// Rewynd composition reads it to build the timeline and to work out the
// total length (see Rewynd.tsx).

import type React from "react";
import type { SceneId } from "../../../contract/recap";
import { Funny } from "./Funny";
import { HardestBug } from "./HardestBug";
import { Heatmap } from "./Heatmap";
import { Hours } from "./Hours";
import { Intro } from "./Intro";
import { MainAI } from "./MainAI";
import { Outro } from "./Outro";
import { PeakHour } from "./PeakHour";
import { Personality } from "./Personality";
import { Projects } from "./Projects";
import { Shipped } from "./Shipped";
import { Tools } from "./Tools";

// Seconds per scene. Each is long enough to read the card in ~2s plus the
// entrance; the reveal and the outro get a little more time. All 12 come to
// ~47s; render.ts usually drops a few, which lands the video at 30–45s.
export const SCENES: Record<SceneId, { component: React.FC; seconds: number }> = {
  intro: { component: Intro, seconds: 3 },
  hours: { component: Hours, seconds: 4 },
  mainAI: { component: MainAI, seconds: 3.5 },
  heatmap: { component: Heatmap, seconds: 4 },
  peakHour: { component: PeakHour, seconds: 3.5 },
  projects: { component: Projects, seconds: 4 },
  tools: { component: Tools, seconds: 3.5 },
  shipped: { component: Shipped, seconds: 4 },
  funny: { component: Funny, seconds: 4.5 },
  hardestBug: { component: HardestBug, seconds: 3.5 },
  personality: { component: Personality, seconds: 4.5 },
  outro: { component: Outro, seconds: 4.5 },
};

export const FPS = 30;

/** Frames for one scene. */
export const sceneFrames = (id: SceneId) => Math.round(SCENES[id].seconds * FPS);

/** Total frames for a list of scenes (at least 1, so an empty list still renders). */
export const totalFrames = (ids: SceneId[]) => Math.max(1, ids.reduce((sum, id) => sum + sceneFrames(id), 0));
