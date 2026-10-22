// =============================================================================
// store/days-store.ts — read and write data/days/YYYY-MM-DD.json.
//
// save: merge each fresh day into the saved one (never shrinking, see
//       merge.ts) and write it atomically (write-then-rename).
// load: read the saved days for a date range. Missing days stay missing (a gap
//       is NOT the same as a quiet day, and the stats keep that difference).
// =============================================================================

import fs from "node:fs";
import type { AgentId } from "../../contract/recap.ts";
import path from "node:path";
import { daysDir } from "../lib/paths.ts";
import { readJsonFile, writeJsonAtomic } from "../lib/files.ts";
import { warn } from "../lib/log.ts";
import { DAY_SCHEMA_VERSION, type DayRecord } from "./day.ts";
import { mergeDay } from "./merge.ts";

const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;
const dayPath = (date: string) => path.join(daysDir(), `${date}.json`);

/** Load one saved day, upgrading old schema versions in memory. */
export function loadDay(date: string): DayRecord | null {
  const rec = readJsonFile<DayRecord | null>(dayPath(date), null);
  if (!rec) return null;
  return migrate(rec);
}

/** Every saved date, sorted. */
export function savedDates(): string[] {
  try {
    return fs
      .readdirSync(daysDir())
      .map((f) => f.match(DAY_FILE)?.[1])
      .filter((d): d is string => !!d)
      .sort();
  } catch {
    return [];
  }
}

/** Saved days between from and to (inclusive). */
export function loadDays(from: string, to: string): Map<string, DayRecord> {
  const out = new Map<string, DayRecord>();
  for (const date of savedDates()) {
    if (date < from || date > to) continue;
    const d = loadDay(date);
    if (d) out.set(date, d);
  }
  return out;
}

export type SaveReport = { created: number; updated: number; unchanged: number };

/** Merge fresh days into data/days/ with the never-shrink rule. */
export function saveDays(fresh: DayRecord[], onDiskSince: Partial<Record<AgentId, string>> = {}): SaveReport {
  const report: SaveReport = { created: 0, updated: 0, unchanged: 0 };
  for (const day of fresh) {
    const saved = loadDay(day.date);
    const { day: merged, changed } = mergeDay(saved, day, onDiskSince);
    if (!changed) {
      report.unchanged++;
      continue;
    }
    writeJsonAtomic(dayPath(day.date), merged);
    if (saved) report.updated++;
    else report.created++;
  }
  return report;
}

/**
 * Upgrade older day files in memory (never deleting them). There's only
 * version 1 today; future versions add steps here instead of breaking old data.
 */
function migrate(rec: DayRecord): DayRecord {
  if (rec.schemaVersion > DAY_SCHEMA_VERSION) {
    warn(`data/days/${rec.date}.json was written by a newer rewynd; reading what we understand`);
  }
  rec.hours ??= new Array(24).fill(0);
  rec.projects ??= [];
  rec.switches ??= { pairs: {} };
  rec.agents ??= {};
  return rec;
}
