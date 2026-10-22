// =============================================================================
// migrate.ts — keep your saved days when rewynd is updated or reinstalled.
//
// Where data/ lives depends on how rewynd was installed:
//   • git clone:                  <repo>/data/      (git pull never touches it)
//   • npx skills add:             ~/.rewynd/data/   (skill updates wipe the skill folder)
//   • Claude Code plugin:         ${CLAUDE_PLUGIN_DATA}/data/  (kept across plugin
//                                 updates; the versioned plugin folder is not)
// If you switch install methods, or an old install left days behind, these
// helpers find them and copy them over with the never-shrink merge. Copy,
// never move: the old files stay where they were.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, REWYND_ROOT, dataDir, home, isDir, tildify } from "./lib/paths.ts";
import { readJsonFile } from "./lib/files.ts";
import { saveDays } from "./store/days-store.ts";
import type { DayRecord } from "./store/day.ts";

const DAY = /^\d{4}-\d{2}-\d{2}\.json$/;

/** Folders that look like an older rewynd data/ with saved days (excluding the current one). */
export function previousDataCandidates(): { dir: string; days: number }[] {
  // Every place a rewynd install may have kept days: the repo clone, the skill
  // folder itself, the home folder default, and the skills-CLI install folder.
  const candidates = new Set<string>([
    path.join(REWYND_ROOT, "data"),
    ...(REPO_ROOT ? [path.join(REPO_ROOT, "data")] : []),
    path.join(home(), ".rewynd", "data"),
    path.join(home(), ".agents", "skills", "rewynd", "data"),
  ]);
  // Old plugin versions (kept ~14 days after an update before cleanup).
  const cache = path.join(home(), ".claude", "plugins", "cache");
  for (const market of safeReaddir(cache)) {
    for (const plugin of safeReaddir(path.join(cache, market))) {
      if (plugin !== "rewynd") continue;
      for (const version of safeReaddir(path.join(cache, market, plugin))) candidates.add(path.join(cache, market, plugin, version, "data"));
    }
  }
  // Persistent plugin data folders.
  for (const id of safeReaddir(path.join(home(), ".claude", "plugins", "data"))) {
    if (id.startsWith("rewynd")) candidates.add(path.join(home(), ".claude", "plugins", "data", id, "data"));
  }
  const current = path.resolve(dataDir());
  return [...candidates]
    .filter((d) => path.resolve(d) !== current && isDir(path.join(d, "days")))
    .map((d) => ({ dir: tildify(d), days: safeReaddir(path.join(d, "days")).filter((f) => DAY.test(f)).length }))
    .filter((c) => c.days > 0);
}

/** Copy saved days (and preferences, if you have none yet) from another data folder. */
export function migrateFrom(from: string) {
  const src = isDir(path.join(from, "days")) ? from : path.join(from, "data");
  const daysDir = path.join(src, "days");
  if (!isDir(daysDir)) throw new Error(`no saved days found in ${tildify(from)}`);
  const days = safeReaddir(daysDir)
    .filter((f) => DAY.test(f))
    .map((f) => readJsonFile<DayRecord | null>(path.join(daysDir, f), null))
    .filter((d): d is DayRecord => !!d);
  const report = saveDays(days);
  const prefsSrc = path.join(src, "preferences.json");
  const prefsDst = path.join(dataDir(), "preferences.json");
  let prefsCopied = false;
  if (fs.existsSync(prefsSrc) && !fs.existsSync(prefsDst)) {
    fs.copyFileSync(prefsSrc, prefsDst);
    prefsCopied = true;
  }
  return { from: tildify(src), daysRead: days.length, ...report, prefsCopied };
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}
