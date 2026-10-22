// =============================================================================
// store/coverage.ts — which dates rewynd has actually SEEN, per agent.
//
// Days with no activity don't get a day file. So "no file for Oct 3" could
// mean "you took the day off" or "rewynd never saw Oct 3 because the
// transcripts were already deleted". The video must not show a quiet day as
// lost history, or a lost day as zero work.
//
// So on every save we record, per agent, the date range whose logs were still
// on disk (oldest activity found → today). data/coverage.json keeps the union
// of those ranges over all runs:
//   { "claude-code": [["2026-10-11","2026-10-22"]], "codex": [["2026-03-04","2026-10-22"]] }
// A date covered by any agent = "seen". Not seen and not saved = a real gap.
// =============================================================================

import path from "node:path";
import type { AgentId } from "../../contract/recap.ts";
import { dataDir } from "../lib/paths.ts";
import { readJsonFile, writeJsonAtomic } from "../lib/files.ts";
import { addDays } from "../lib/time.ts";

type Range = [string, string];
export type Coverage = Partial<Record<AgentId, Range[]>>;

const file = () => path.join(dataDir(), "coverage.json");

export const loadCoverage = (): Coverage => readJsonFile<Coverage>(file(), {});

/** Add a seen range for an agent and save (ranges are merged when they touch). */
export function addCoverage(agent: AgentId, from: string, to: string): void {
  const cov = loadCoverage();
  cov[agent] = mergeRanges([...(cov[agent] ?? []), [from, to]]);
  writeJsonAtomic(file(), cov);
}

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0].localeCompare(b[0]));
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= addDays(last[1], 1)) {
      if (r[1] > last[1]) last[1] = r[1];
    } else out.push([r[0], r[1]]);
  }
  return out;
}

/** Was this date seen by any agent? */
export function isCovered(cov: Coverage, date: string): boolean {
  for (const ranges of Object.values(cov)) {
    for (const [a, b] of ranges ?? []) if (date >= a && date <= b) return true;
  }
  return false;
}
