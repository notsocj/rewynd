// =============================================================================
// render/prefs.ts — data/preferences.json: the user's saved choices.
//
// Design choices are asked once (by the skill) and reused on later runs
// ("Use the same look as last time?"). Also holds optional extra git emails
// ("these addresses are also me") for the "What you shipped" scene.
// =============================================================================

import { DEFAULT_PREFS, type DesignPrefs } from "../../contract/recap.ts";
import { prefsFile } from "../lib/paths.ts";
import { readJsonFile, writeJsonAtomic } from "../lib/files.ts";

export type Preferences = {
  /** null = never asked yet (the skill should ask the design questions). */
  design: DesignPrefs | null;
  gitEmails: string[];
};

export function loadPrefs(): Preferences {
  const raw = readJsonFile<Partial<Preferences>>(prefsFile(), {});
  return {
    design: raw.design ? { ...DEFAULT_PREFS, ...raw.design } : null,
    gitEmails: Array.isArray(raw.gitEmails) ? raw.gitEmails.filter((e) => typeof e === "string") : [],
  };
}

/** Merge a partial update (from `cli.ts prefs --set '{...}'`) and save. */
export function updatePrefs(patch: { design?: Partial<DesignPrefs>; gitEmails?: string[] }): Preferences {
  const cur = loadPrefs();
  const next: Preferences = {
    design: patch.design ? validateDesign({ ...(cur.design ?? DEFAULT_PREFS), ...patch.design }) : cur.design,
    gitEmails: patch.gitEmails ?? cur.gitEmails,
  };
  writeJsonAtomic(prefsFile(), next);
  return next;
}

/** Reject impossible values early with a message the skill can relay. */
export function validateDesign(d: DesignPrefs): DesignPrefs {
  if (typeof d.theme !== "string" || !d.theme) throw new Error("design.theme must be a template id (tape, terminal, receipt, arcade) or \"auto\"");
  if (d.accent !== null && d.accent !== undefined && typeof d.accent !== "string") throw new Error("design.accent must be an accent id from `themes`, or null");
  d.accent = d.accent ?? null;
  if (!["vertical", "wide", "both"].includes(d.format)) throw new Error("design.format must be vertical, wide or both");
  if (d.font?.kind !== "inter" && !(d.font?.kind === "custom" && typeof (d.font as any).file === "string")) {
    throw new Error('design.font must be {"kind":"inter"} or {"kind":"custom","file":"/path/to/font.ttf"}');
  }
  if (typeof d.hideProjectNames !== "boolean") throw new Error("design.hideProjectNames must be true or false");
  return d;
}
