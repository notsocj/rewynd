// =============================================================================
// render/render.ts — stage 3: stats.json + story.json + design prefs → video.
//
//   1. validate story.json against stats.json (no invented numbers)
//   2. resolve the theme ("auto" → the theme mapped to your personality)
//   3. pick the scenes that have something to show (e.g. "Your main AI" needs
//      2+ agents, "What you shipped" needs commits)
//   4. hide project names if you asked to (Project A / B / C)
//   5. write output/props.json and call the pre-built Remotion template
//
// Claude never writes Remotion code at this stage: the template in video/ is
// fixed and only receives props. That keeps every run cheap and consistent.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DEFAULT_PREFS,
  REPO_URL,
  SCENE_ORDER,
  type DesignPrefs,
  type RecapProps,
  type SceneId,
  type Stats,
  type Story,
} from "../../contract/recap.ts";
import { VIDEO_DIR, exists, outputDir } from "../lib/paths.ts";
import { readJsonFile, writeJsonAtomic } from "../lib/files.ts";
import { info } from "../lib/log.ts";
import { periodSlug } from "../stats/period.ts";
import { bugNumbersFrom, validateStory } from "../story/validate-story.ts";
import { loadPrefs } from "./prefs.ts";

/** Composition ids registered in video/src/Root.tsx. */
export const VIDEO_COMPOSITION = "Rewynd";
export const CARD_COMPOSITION = "RewyndCard";

export type RenderOptions = { card: boolean; format?: DesignPrefs["format"] };
export type RenderResult = { files: string[]; props: string; scenes: SceneId[]; theme: string; accent: string | null };

// -----------------------------------------------------------------------------
// Themes (owned by the video template: video/src/themes.json)
// -----------------------------------------------------------------------------

export type AccentInfo = { id: string; label: string; color: string };
/** A card TEMPLATE (tape, terminal, receipt, arcade) and its accent colors. */
export type ThemeInfo = { id: string; label: string; description?: string; accents: AccentInfo[] };

/** Read the template list + personality→template map from the video template. */
export function loadThemes(): { default: string; themes: ThemeInfo[]; byPersonality: Record<string, { theme: string; accent: string }> } {
  const raw = readJsonFile<any>(path.join(VIDEO_DIR, "src", "themes.json"), null);
  const list: any[] = Array.isArray(raw?.themes) ? raw.themes : [];
  const themes = list
    .filter((t) => t && typeof t.id === "string")
    .map((t) => ({
      id: t.id,
      label: t.label ?? t.id,
      description: t.description,
      accents: Array.isArray(t.accents) ? t.accents.filter((a: any) => a && typeof a.id === "string") : [],
    }));
  const map = raw?.personalityThemes && typeof raw.personalityThemes === "object" ? raw.personalityThemes : {};
  return { default: typeof raw?.default === "string" ? raw.default : themes[0]?.id ?? "tape", themes, byPersonality: map };
}

// Old v0.1 theme ids → the template that replaced them (kept so saved
// preferences from before still work).
const LEGACY_THEMES: Record<string, { theme: string; accent: string }> = {
  night: { theme: "tape", accent: "mint" },
  midnight: { theme: "tape", accent: "mint" },
  bluescreen: { theme: "tape", accent: "amber" },
  label: { theme: "receipt", accent: "yellow" },
};

/** "auto" → the personality's template + accent; unknown ids → the default template. */
export function resolveTheme(prefs: DesignPrefs, story: Story): { theme: string; accent: string | null } {
  const { themes, byPersonality, default: fallback } = loadThemes();
  let theme = prefs.theme;
  let accent = prefs.accent ?? null;
  if (LEGACY_THEMES[theme]) ({ theme, accent } = { theme: LEGACY_THEMES[theme].theme, accent: accent ?? LEGACY_THEMES[theme].accent });
  if (theme === "auto") {
    const pick = byPersonality[story.personality.id];
    theme = pick?.theme ?? fallback;
    accent = accent ?? pick?.accent ?? null;
  }
  const entry = themes.find((t) => t.id === theme) ?? themes.find((t) => t.id === fallback);
  if (!entry) return { theme: fallback, accent: null };
  return { theme: entry.id, accent: entry.accents.some((a) => a.id === accent) ? accent : entry.accents[0]?.id ?? null };
}

// -----------------------------------------------------------------------------
// Scenes
// -----------------------------------------------------------------------------

export function pickScenes(stats: Stats, story: Story): SceneId[] {
  const has: Record<SceneId, boolean> = {
    intro: true,
    hours: stats.totals.activeMinutes > 0,
    mainAI: stats.agents.length >= 2, // only interesting with 2+ agents
    heatmap: stats.time.heatmap.length > 0,
    peakHour: stats.time.busiestHour !== null,
    projects: stats.projects.length > 0,
    tools: stats.tools.length > 0,
    shipped: !!stats.shipped && stats.shipped.commits > 0, // skipped in a month with no commits
    funny: story.funnyLines.length > 0 || !!story.backgroundLine,
    hardestBug: !!story.hardestBug,
    personality: true,
    outro: true,
  };
  return SCENE_ORDER.filter((s) => has[s]);
}

// -----------------------------------------------------------------------------
// Hide project names
// -----------------------------------------------------------------------------

/** Replace every project/repo name with "Project A", "Project B"... everywhere it appears. */
export function anonymize(stats: Stats, story: Story): { stats: Stats; story: Story } {
  const s: Stats = structuredClone(stats);
  const st: Story = structuredClone(story);
  const names = [
    ...s.projects.map((p) => p.name),
    ...(s.shipped?.byRepo.map((r) => r.name) ?? []),
    ...(s.longestSession ? [s.longestSession.project] : []),
    ...st.projects.map((p) => p.name),
    ...(st.hardestBug?.project ? [st.hardestBug.project] : []),
  ];
  const alias = new Map<string, string>();
  for (const n of names) {
    if (!alias.has(n)) alias.set(n, `Project ${letters(alias.size)}`);
  }
  const rename = (n: string) => alias.get(n) ?? n;
  // Longest names first, so "lumen-web" is replaced before "lumen".
  const ordered = [...alias.keys()].sort((a, b) => b.length - a.length);
  const scrub = (text: string) =>
    ordered.reduce((t, n) => t.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), alias.get(n)!), text);

  s.projects = s.projects.map((p) => ({ ...p, name: rename(p.name) }));
  if (s.shipped) s.shipped.byRepo = s.shipped.byRepo.map((r) => ({ ...r, name: rename(r.name) }));
  if (s.longestSession) s.longestSession.project = rename(s.longestSession.project);
  st.projects = st.projects.map((p) => ({ name: rename(p.name), line: scrub(p.line) }));
  if (st.hardestBug) st.hardestBug = { project: st.hardestBug.project ? rename(st.hardestBug.project) : null, line: scrub(st.hardestBug.line) };
  st.captions = Object.fromEntries(Object.entries(st.captions).map(([k, v]) => [k, scrub(String(v))]));
  st.funnyLines = st.funnyLines.map(scrub);
  if (st.backgroundLine) st.backgroundLine = scrub(st.backgroundLine);
  st.personality = { ...st.personality, line: scrub(st.personality.line) };
  st.closing = scrub(st.closing);
  return { stats: s, story: st };
}

const letters = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letters(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

// -----------------------------------------------------------------------------
// Render
// -----------------------------------------------------------------------------

export function buildProps(opts: RenderOptions): { props: RecapProps; errors: string[] } {
  const stats = readJsonFile<Stats | null>(path.join(outputDir(), "stats.json"), null);
  if (!stats) throw new Error("output/stats.json is missing. Run `collect` first");
  const story = readJsonFile<Story | null>(path.join(outputDir(), "story.json"), null);
  if (!story) throw new Error("output/story.json is missing. Claude writes it in the /rewynd skill");
  const check = validateStory(story, stats, bugNumbersFrom(readJsonFile<unknown>(path.join(outputDir(), "samples.json"), null)));
  if (!check.ok) return { props: null as unknown as RecapProps, errors: check.errors };

  const design = { ...DEFAULT_PREFS, ...(loadPrefs().design ?? {}) };
  if (opts.format) design.format = opts.format;
  const look = resolveTheme(design, story);
  design.theme = look.theme;
  design.accent = look.accent;

  const { stats: s, story: st } = design.hideProjectNames ? anonymize(stats, story) : { stats, story };

  return {
    props: {
      stats: s,
      story: st,
      prefs: design,
      scenes: pickScenes(s, st),
      repoUrl: REPO_URL,
      customFontStaticPath: design.font.kind === "custom" ? stageAsset(design.font.file, "font") : null,
      musicStaticPath: design.musicFile ? stageAsset(design.musicFile, "music") : null,
    },
    errors: [],
  };
}

/**
 * Copy a user file (custom font, music) into video/public/rewynd-user/ so the
 * Remotion template can load it with staticFile(). Returns its public path,
 * or null if the file can't be found (the template then falls back to Inter
 * / silence).
 */
function stageAsset(file: string, kind: "font" | "music"): string | null {
  if (!file || !exists(file)) {
    info(`Your ${kind} file wasn't found (${file}); using the default instead`);
    return null;
  }
  const dir = path.join(VIDEO_DIR, "public", "rewynd-user");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${kind}${path.extname(file).toLowerCase()}`;
  fs.copyFileSync(file, path.join(dir, name));
  return `rewynd-user/${name}`;
}

/**
 * Remotion's command-line program, as a plain JS file we run with `node`.
 * Not node_modules/.bin/remotion: that's a symlink (a .cmd on Windows), and
 * when a skill folder gets copied with symlinks resolved, the .bin launcher
 * breaks while the real file keeps working.
 */
const REMOTION_CLI = () => path.join(VIDEO_DIR, "node_modules", "@remotion", "cli", "remotion-cli.js");

/** Install the video template's dependencies on first render (one-time download). */
export function ensureVideoDeps(): void {
  // Check a real file deep inside the package, not just the folder: a
  // half-finished or badly copied install must trigger a clean reinstall.
  if (exists(REMOTION_CLI()) && exists(path.join(VIDEO_DIR, "node_modules", "@remotion", "cli", "dist", "index.js"))) return;
  info("First render: installing the video template's dependencies (one-time, needs internet)…");
  const npm = (args: string[]) =>
    spawnSync("npm", [...args, "--no-audit", "--no-fund"], { cwd: VIDEO_DIR, stdio: ["ignore", 2, 2], shell: process.platform === "win32" });
  // `npm ci` installs exactly what the lockfile says (reproducible renders).
  // Older npm versions (npm 10, bundled with Node 22) sometimes refuse a
  // lockfile written by a newer npm; then a normal install still works.
  let r = exists(path.join(VIDEO_DIR, "package-lock.json")) ? npm(["ci"]) : null;
  if (!r || r.status !== 0) r = npm(["install"]);
  if (r.status !== 0) throw new Error("couldn't install the video template's dependencies (npm failed, see above)");
}

export function render(opts: RenderOptions): RenderResult | { errors: string[] } {
  const { props, errors } = buildProps(opts);
  if (errors.length) return { errors };
  ensureVideoDeps();

  const slug = periodSlug(props.stats.period);
  const formats: ("vertical" | "wide")[] = props.prefs.format === "both" ? ["vertical", "wide"] : [props.prefs.format];
  const files: string[] = [];
  let propsFile = "";
  for (const format of formats) {
    const p: RecapProps = { ...props, prefs: { ...props.prefs, format } };
    propsFile = path.join(outputDir(), `props${formats.length > 1 ? `-${format}` : ""}.json`);
    writeJsonAtomic(propsFile, p);
    const suffix = format === "wide" ? "-wide" : "";
    const out = path.join(outputDir(), opts.card ? `rewynd-card-${slug}${suffix}.png` : `rewynd-${slug}${suffix}.mp4`);
    // Its own port, so a Remotion Studio left open on the default port
    // (3000) can't make the render fail.
    const port = `--port=${3100 + Math.floor(Math.random() * 800)}`;
    const args = opts.card
      ? ["still", "src/index.ts", CARD_COMPOSITION, out, `--props=${propsFile}`, port]
      : ["render", "src/index.ts", VIDEO_COMPOSITION, out, `--props=${propsFile}`, port];
    info(`Rendering ${path.basename(out)}…`);
    const r = spawnSync(process.execPath, [REMOTION_CLI(), ...args], { cwd: VIDEO_DIR, stdio: ["ignore", 2, 2] });
    if (r.status !== 0) throw new Error(`Remotion failed to render ${path.basename(out)} (see the log above)`);
    files.push(out);
  }
  return { files, props: propsFile, scenes: props.scenes, theme: props.prefs.theme, accent: props.prefs.accent };
}
