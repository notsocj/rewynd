// =============================================================================
// status.ts — what rewynd has saved, what's still on disk, and what's at risk.
//
// Powers /rewynd-status and /rewynd-setup. Runs a save first (so the answer
// is current), then reports:
//   • each agent: found? where? supported?
//   • saved days: how many, first/last, gaps in the last 90 days
//   • Claude Code retention: your cleanupPeriodDays (READ, never changed),
//     the oldest transcript still on disk, and when it will be deleted
//   • where data/ lives, and whether git is (wrongly) tracking it
//   • older rewynd installs with saved days that could be copied over
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { AGENT_LABELS } from "../contract/recap.ts";
import { claudeHome, dataDir, listFiles, tildify } from "./lib/paths.ts";
import { readJsonFile } from "./lib/files.ts";
import { addDays, daysBetween, eachDate, localDate, today } from "./lib/time.ts";
import { collect } from "./collect.ts";
import { savedDates } from "./store/days-store.ts";
import { isCovered, loadCoverage } from "./store/coverage.ts";
import { previousDataCandidates } from "./migrate.ts";

const DEFAULT_RETENTION = 30;

export async function status() {
  const run = await collect({ period: null, github: false });
  const dates = savedDates();
  const cov = loadCoverage();
  const last90 = eachDate(addDays(today(), -89), today());
  const gaps = last90.filter((d) => !dates.includes(d) && !isCovered(cov, d));

  return {
    dataDir: tildify(dataDir()),
    saved: {
      days: dates.length,
      first: dates[0] ?? null,
      last: dates[dates.length - 1] ?? null,
      thisRun: run.saved,
      gapsLast90Days: gaps.length,
      gapRanges: toRanges(gaps),
    },
    agents: run.agents.map((a) => ({
      id: a.id,
      label: AGENT_LABELS[a.id],
      found: a.found,
      supported: a.supported,
      humanSessions: a.humanSessions,
      backgroundSessions: a.backgroundSessions,
      onDiskSince: cov[a.id]?.[cov[a.id]!.length - 1]?.[0] ?? null,
      note: a.error ? `error: ${a.error}` : a.note,
    })),
    claudeRetention: claudeRetention(),
    previousData: dates.length === 0 ? previousDataCandidates() : [],
  };
}

/** Claude Code's deletion schedule, read-only. */
function claudeRetention() {
  const settings = readJsonFile<any>(path.join(claudeHome(), "settings.json"), {});
  const configured = Number(settings?.cleanupPeriodDays);
  const days = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RETENTION;
  let oldest: string | null = null;
  for (const f of listFiles(path.join(claudeHome(), "projects"), (n) => n.endsWith(".jsonl"))) {
    try {
      const d = localDate(fs.statSync(f).mtimeMs);
      if (!oldest || d < oldest) oldest = d;
    } catch {
      /* vanished while listing */
    }
  }
  const deletesOn = oldest ? addDays(oldest, days) : null;
  return {
    cleanupPeriodDays: days,
    isDefault: !(Number.isFinite(configured) && configured > 0),
    oldestTranscript: oldest,
    oldestDeletedOn: deletesOn,
    daysUntilNextDeletion: deletesOn ? Math.max(0, daysBetween(today(), deletesOn)) : null,
    advice: `Run /rewynd (or /rewynd-status) at least once every ${days} days so no day is lost. rewynd never changes this setting.`,
  };
}

function toRanges(dates: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (const d of dates) {
    const last = out[out.length - 1];
    if (last && addDays(last[1], 1) === d) last[1] = d;
    else out.push([d, d]);
  }
  return out;
}
