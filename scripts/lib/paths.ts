// =============================================================================
// lib/paths.ts — every folder rewynd reads from or writes to, in one place.
//
// Two kinds of folders:
//   1. Where rewynd keeps ITS OWN stuff (daily totals, preferences, outputs).
//   2. Where each AI agent keeps ITS logs (read-only for us, always).
//
// Keeping all path logic here means macOS / Linux / Windows differences and
// env-var overrides are handled once, instead of in every adapter.
// =============================================================================

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/** The rewynd folder itself (repo clone or installed plugin): two levels up from scripts/lib/. */
export const REWYND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The Remotion template that renders the video. */
export const VIDEO_DIR = path.join(REWYND_ROOT, "video");

// -----------------------------------------------------------------------------
// rewynd's own state
// -----------------------------------------------------------------------------
// "State root" = the folder that holds data/ (daily totals + prefs) and output/
// (stats.json, the video...).
//
// Resolution order:
//   1. --data-dir <dir> on the command line (set by the skill; in a Claude Code
//      plugin install the skill passes ${CLAUDE_PLUGIN_DATA}, which survives
//      plugin updates, unlike the versioned plugin folder itself)
//   2. REWYND_DATA_DIR environment variable (for people who want it elsewhere)
//   3. the rewynd folder itself (git clone / Codex skills install): <repo>/data
//
// An empty string counts as "not set". When a skill's ${...} placeholder isn't
// substituted (e.g. in Codex), the shell expands it to "" and we fall through.

let stateRootOverride: string | null = null;

/** Called once by the CLI after parsing --data-dir. */
export function setStateRoot(dir: string | null | undefined): void {
  stateRootOverride = dir && dir.trim() ? path.resolve(expandHome(dir.trim())) : null;
}

export function stateRoot(): string {
  if (stateRootOverride) return stateRootOverride;
  const env = process.env.REWYND_DATA_DIR;
  if (env && env.trim()) return path.resolve(expandHome(env.trim()));
  return REWYND_ROOT;
}

/** data/: rewynd's memory. Git-ignored, never pushed, kept across updates. */
export const dataDir = (): string => path.join(stateRoot(), "data");
/** data/days/YYYY-MM-DD.json: one aggregate file per day. */
export const daysDir = (): string => path.join(dataDir(), "days");
/** data/preferences.json: saved design choices. */
export const prefsFile = (): string => path.join(dataDir(), "preferences.json");
/** output/: regenerated every run (stats.json, samples.json, props.json, videos). */
export const outputDir = (): string => path.join(stateRoot(), "output");

// -----------------------------------------------------------------------------
// Home + OS conventions
// -----------------------------------------------------------------------------

export const home = (): string => os.homedir();

/** "~/foo" → "/Users/me/foo". Leaves other paths alone. */
export function expandHome(p: string): string {
  if (p === "~") return home();
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(home(), p.slice(2));
  return p;
}

/** "/Users/me/foo" → "~/foo", for printing paths without exposing the username. */
export function tildify(p: string): string {
  const h = home();
  return p === h ? "~" : p.startsWith(h + path.sep) ? "~" + p.slice(h.length) : p;
}

export const isWindows = process.platform === "win32";
export const isMac = process.platform === "darwin";

/**
 * Where apps keep config-like data:
 *   macOS  ~/Library/Application Support
 *   Windows %APPDATA% (Roaming)
 *   Linux  $XDG_CONFIG_HOME or ~/.config
 */
export function appSupportDir(): string {
  if (isMac) return path.join(home(), "Library", "Application Support");
  if (isWindows) return process.env.APPDATA || path.join(home(), "AppData", "Roaming");
  return process.env.XDG_CONFIG_HOME || path.join(home(), ".config");
}

/**
 * XDG "data home" (used by OpenCode):
 *   $XDG_DATA_HOME, else ~/.local/share. On Windows tools usually fall back
 *   to %LOCALAPPDATA%, so we check that too (see opencode.ts).
 */
export function xdgDataHome(): string {
  return process.env.XDG_DATA_HOME || path.join(home(), ".local", "share");
}

// -----------------------------------------------------------------------------
// Agent home folders (each honours its documented env override)
// -----------------------------------------------------------------------------

/** Claude Code: ~/.claude, or $CLAUDE_CONFIG_DIR. */
export const claudeHome = (): string => process.env.CLAUDE_CONFIG_DIR || path.join(home(), ".claude");

/** Codex: ~/.codex, or $CODEX_HOME. */
export const codexHome = (): string => process.env.CODEX_HOME || path.join(home(), ".codex");

/**
 * Gemini CLI: ~/.gemini. Overrides: $GEMINI_DATA_DIR (points straight at the
 * .gemini folder) or $GEMINI_CLI_HOME (a home folder that contains .gemini).
 */
export function geminiHome(): string {
  if (process.env.GEMINI_DATA_DIR) return process.env.GEMINI_DATA_DIR;
  if (process.env.GEMINI_CLI_HOME) return path.join(process.env.GEMINI_CLI_HOME, ".gemini");
  return path.join(home(), ".gemini");
}

// -----------------------------------------------------------------------------
// Small filesystem helpers used everywhere
// -----------------------------------------------------------------------------

export function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recursively list files under `dir` whose name passes `match`.
 * Synchronous on purpose: listing is fast even for thousands of files, and it
 * keeps adapters simple. Unreadable folders are skipped, never fatal.
 */
export function listFiles(dir: string, match: (name: string) => boolean, maxDepth = 8): string[] {
  const out: string[] = [];
  const walk = (d: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return; // permission denied, vanished folder... just skip it
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile() && match(e.name)) out.push(p);
    }
  };
  walk(dir, 0);
  return out;
}
