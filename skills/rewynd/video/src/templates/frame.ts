// Shared plumbing between a template's FRAME (the chrome around a card) and
// the scene content inside it.
//
// Every template draws a different frame: the tape has a camcorder display
// and transport buttons, the terminal is one big window, the receipt is a
// strip of paper on a color field, the arcade is a cabinet screen. Each frame
// leaves a different rectangle free for the scene's content, and tells
// <Stage> where it is through ContentRectContext. Scenes never need to know
// which template they're in to lay themselves out.

import { createContext, useContext } from "react";
import type { SceneId } from "../../../contract/recap";

/** Margins (px) from each card edge to the area scene content may use. */
export type ContentRect = { left: number; right: number; top: number; bottom: number; align: "left" | "center" };

export const ContentRectContext = createContext<ContentRect>({ left: 96, right: 96, top: 290, bottom: 400, align: "left" });

/** Margins of the content area inside the current frame. */
export const useContentRect = () => useContext(ContentRectContext);

/** Which scene is being drawn (set by <Rewynd> / <SingleScene> / <RewyndCard>). */
export const SceneIdContext = createContext<SceneId>("intro");
export const useSceneId = () => useContext(SceneIdContext);

/** Short human title for each scene, used by frames and headings. */
export const SCENE_TITLES: Record<SceneId, string> = {
  intro: "The recap",
  hours: "Hours with AI",
  mainAI: "Your main AI",
  heatmap: "Every day",
  peakHour: "Peak hour",
  projects: "Top projects",
  tools: "Top tools",
  shipped: "Shipped",
  funny: "Blooper reel",
  hardestBug: "Hardest bug",
  personality: "Coder personality",
  outro: "The recap",
};

/** Command-line name for each scene, used by the terminal template. */
export const SCENE_COMMANDS: Record<SceneId, string> = {
  intro: "",
  hours: "rewynd hours",
  mainAI: "rewynd agents --share",
  heatmap: "rewynd calendar",
  peakHour: "rewynd peak-hour",
  projects: "ls ~/projects --by-time",
  tools: "rewynd tools --top 5",
  shipped: "git log --author=me --ai",
  funny: "rewynd bloopers",
  hardestBug: "npm test",
  personality: "whoami",
  outro: "rewynd --summary",
};

/** "Top tools" → "top_tools" (terminal-style identifiers). */
export const snake = (s: string) =>
  s
    .toLowerCase()
    .replace(/^the\s+/, "the_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
