// =============================================================================
// collect.ts — stage 1 of rewynd: logs → saved days → stats.json (+ samples).
//
//   1. detect which agents have data on this machine
//   2. stream every session from every found agent (one failing agent never
//      stops the others), building per-day totals as we go
//   3. add git ("What you shipped") and, only with --github, GitHub numbers
//   4. SAVE new/grown days into data/days/ (never shrinking a saved day)
//   5. build stats.json for the chosen period FROM THE SAVED DAYS
//   6. pick a small redacted sample of messages for the story (samples.json)
//
// Zero tokens: this is plain code. Claude only ever reads the two small
// output files, never the logs.
// =============================================================================

import path from "node:path";
import type { AgentId, Period, Stats } from "../contract/recap.ts";
import { AGENT_LABELS } from "../contract/recap.ts";
import { outputDir } from "./lib/paths.ts";
import { writeJsonAtomic } from "./lib/files.ts";
import { addDays, localDate, timezone, today } from "./lib/time.ts";
import { info, warn, errMsg } from "./lib/log.ts";
import { detectAll } from "./sources/index.ts";
import { projectOf } from "./sources/project-name.ts";
import { sessionBounds } from "./sources/types.ts";
import { DayBuilder } from "./store/build-days.ts";
import { emptyDay, type DayRecord } from "./store/day.ts";
import { loadDays, saveDays, type SaveReport } from "./store/days-store.ts";
import { addCoverage, loadCoverage } from "./store/coverage.ts";
import { collectShipped, type RepoActivity } from "./shipped/collect-shipped.ts";
import { collectGithub } from "./shipped/github.ts";
import { buildStats } from "./stats/build-stats.ts";
import { SamplePicker } from "./samples/pick-samples.ts";
import { loadPrefs } from "./render/prefs.ts";

export type CollectOptions = {
  /** null = save days only (used by status/setup); no stats or samples. */
  period: Period | null;
  github: boolean;
  /** Skip git entirely (faster; used by tests). */
  noGit?: boolean;
};

export type CollectResult = {
  agents: { id: AgentId; label: string; found: boolean; supported: boolean; humanSessions: number; backgroundSessions: number; note?: string; error?: string }[];
  saved: SaveReport;
  stats: Stats | null;
  files: { stats?: string; samples?: string };
  github: { requested: boolean; ok: boolean; reason?: string };
};

export async function collect(opts: CollectOptions): Promise<CollectResult> {
  const t0 = Date.now();
  const detections = await detectAll();
  const builder = new DayBuilder();
  const picker = opts.period ? new SamplePicker(opts.period) : null;
  const repos = new Map<string, RepoActivity>();
  const codexHashes = new Set<string>();
  const agentReport: CollectResult["agents"] = [];
  const onDiskSince: Partial<Record<AgentId, string>> = {};

  for (const { adapter, result } of detections) {
    const row: CollectResult["agents"][number] = {
      id: adapter.id,
      label: AGENT_LABELS[adapter.id],
      found: result.found,
      supported: result.supported !== false,
      humanSessions: 0,
      backgroundSessions: 0,
      note: result.note,
    };
    agentReport.push(row);
    if (!result.found || result.supported === false) continue;

    info(`Reading ${row.label}…`);
    let earliest: string | null = null;
    try {
      // Read everything still on disk: older days get saved too (backfill).
      for await (const s of adapter.collect({ from: "1970-01-01", to: today() })) {
        const b = sessionBounds(s);
        if (!b) continue;
        const startDate = localDate(b.start);
        if (!earliest || startDate < earliest) earliest = startDate;
        builder.add(s);
        if (s.origin === "human") {
          row.humanSessions++;
          picker?.add(s);
          // Remember where/when you worked, for matching commits to sessions.
          const repoRoot = projectOf(s.cwd)?.repoRoot;
          if (repoRoot) {
            const r = repos.get(repoRoot) ?? { root: repoRoot, name: path.basename(repoRoot), windows: [] };
            r.windows.push({ agent: s.agent, start: b.start, end: b.end });
            repos.set(repoRoot, r);
          }
          if (s.agent === "codex") s.commitHashes.forEach((h) => codexHashes.add(h));
        } else row.backgroundSessions++;
      }
      if (earliest) {
        addCoverage(adapter.id, earliest, today());
        onDiskSince[adapter.id] = earliest;
      }
    } catch (e) {
      // One broken adapter never crashes the run.
      row.error = errMsg(e);
      warn(`Skipped ${row.label}: ${row.error}`);
    }
  }

  // ---------------- days (+ git, + github) ----------------
  const fresh = new Map<string, DayRecord>(builder.build().map((d) => [d.date, d]));
  const dayFor = (date: string) => {
    let d = fresh.get(date);
    if (!d) {
      d = emptyDay(date, timezone());
      fresh.set(date, d);
    }
    return d;
  };

  const gitFrom = minDate(opts.period?.from ?? today(), addDays(today(), -90));
  // Git history doesn't get deleted, but codex/* reflogs expire after ~90 days,
  // so every run also refreshes the last 90 days.
  const gitTo = today();
  if (!opts.noGit && repos.size) {
    try {
      const gitDays = await collectShipped({ repos, codexHashes, extraEmails: loadPrefs().gitEmails }, gitFrom, gitTo);
      for (const [date, g] of gitDays) dayFor(date).git = g;
    } catch (e) {
      warn(`git: skipped "What you shipped" (${errMsg(e)})`);
    }
  }

  const github: CollectResult["github"] = { requested: opts.github, ok: false };
  if (opts.github && opts.period) {
    const gh = collectGithub(opts.period.from, minDate(opts.period.to, today()));
    if (gh.ok) {
      github.ok = true;
      for (const [date, g] of gh.days) dayFor(date).github = g;
    } else {
      github.reason = gh.reason;
      warn(`Skipping GitHub: ${gh.reason}`);
    }
  }

  const saved = saveDays(
    [...fresh.values()].sort((a, b) => a.date.localeCompare(b.date)),
    onDiskSince,
  );
  info(`Saved days: ${saved.created} new, ${saved.updated} updated, ${saved.unchanged} unchanged (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  // ---------------- stats + samples for the period ----------------
  const result: CollectResult = { agents: agentReport, saved, stats: null, files: {}, github };
  if (!opts.period) return result;

  const skippedAgents: Stats["skippedAgents"] = agentReport
    .filter((a) => (a.found && (!a.supported || a.error)) || (!a.found && a.note && /installed|exists/.test(a.note)))
    .map((a) => ({ id: a.id, reason: a.error ? `couldn't be read (${a.error})` : a.note ?? "not supported yet" }));

  const stats = buildStats({
    period: opts.period,
    days: loadDays(opts.period.from, opts.period.to),
    coverage: loadCoverage(),
    skippedAgents,
    includeGithub: github.ok,
  });
  const statsFile = path.join(outputDir(), "stats.json");
  writeJsonAtomic(statsFile, stats);
  const samplesFile = path.join(outputDir(), "samples.json");
  writeJsonAtomic(samplesFile, picker!.build());
  result.stats = stats;
  result.files = { stats: statsFile, samples: samplesFile };
  return result;
}

const minDate = (a: string, b: string) => (a < b ? a : b);
