// How the scenes and the transitions between them fit on the video's
// timeline. Used both to build the video (<Rewynd>) and to work out its total
// length before rendering (calculateRecapMetadata), so the two always agree.
//
// Rules:
// - Into the personality reveal and the outro: the colorMorph (the big
//   moments), 26 frames.
// - Everything else: the template's signature transition, 18 frames.
// - Transitions OVERLAP the two scenes. To keep every card on screen as long
//   as before, each scene is lengthened by half of its outgoing transition.
// - Transitions that COVER the screen first (colorMorph, pixelDissolve) hold
//   the incoming scene on its first frame until it's revealed (`hold`), so its
//   entrance animations aren't wasted behind the cover.

import type { SceneId } from "../../../contract/recap";
import { sceneFrames } from "../scenes/registry";
import type { TemplateId } from "../theme";

export type JoinKind = "morph" | "signature";

export const MORPH_FRAMES = 26;
export const SIGNATURE_FRAMES = 18;

export type TimelineStep = {
  id: SceneId;
  /** Frames this scene's sequence lasts (including overlaps). */
  duration: number;
  /** Frames the scene holds its first frame at the start (while being revealed). */
  hold: number;
  /** The transition INTO this scene (none for the first). */
  join: { kind: JoinKind; frames: number } | null;
};

const joinInto = (id: SceneId): { kind: JoinKind; frames: number } =>
  id === "personality" || id === "outro" ? { kind: "morph", frames: MORPH_FRAMES } : { kind: "signature", frames: SIGNATURE_FRAMES };

/** Does this transition cover the screen before revealing the next scene? */
const covers = (kind: JoinKind, template: TemplateId) => kind === "morph" || template === "arcade";

export function buildTimeline(scenes: SceneId[], template: TemplateId): { steps: TimelineStep[]; total: number } {
  const steps: TimelineStep[] = scenes.map((id, i) => {
    const join = i === 0 ? null : joinInto(id);
    const next = i < scenes.length - 1 ? joinInto(scenes[i + 1]) : null;
    const hold = join && covers(join.kind, template) ? Math.round(join.frames / 2) : 0;
    return { id, join, hold, duration: sceneFrames(id) + hold + (next ? Math.round(next.frames / 2) : 0) };
  });
  const overlap = steps.reduce((sum, s) => sum + (s.join?.frames ?? 0), 0);
  const total = Math.max(1, steps.reduce((sum, s) => sum + s.duration, 0) - overlap);
  return { steps, total };
}
