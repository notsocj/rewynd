// =============================================================================
// store/merge.ts — the "never shrink a saved day" rule.
//
// When rewynd runs, it recomputes days from whatever logs are still on disk.
// For an old day whose transcripts were deleted, that fresh version is smaller
// (or empty), and saving it would erase history. So for every day we merge
// the SAVED version with the FRESH one:
//
//   • per agent: keep whichever version of that agent's numbers has more data
//     (compared by your messages, then active minutes, then sessions).
//       - today / a day with new sessions → fresh is bigger → updated
//       - transcripts deleted since       → saved is bigger → kept
//       - a new adapter added later (e.g. Gemini in v0.2) → only that agent's
//         numbers are added; the others stay as they were
//   • day-level numbers (total minutes, hour buckets, projects, switches):
//     each value takes the larger of saved vs fresh.
//   • git / github: keep the version with more commits / the larger counts.
//
// The result can only grow, never shrink. That's the whole promise of data/.
// =============================================================================

import type { AgentId } from "../../contract/recap.ts";
import { ALGO_VERSION, agentDayWeight, type DayRecord, type ProjectDay } from "./day.ts";

/** True if weight a > weight b (compared left to right). */
function heavier(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

export type MergeResult = { day: DayRecord; changed: boolean };

/**
 * @param onDiskSince agent → earliest date whose logs are still on disk this run.
 *   Used only for the counting-rules upgrade below.
 */
export function mergeDay(saved: DayRecord | null, fresh: DayRecord, onDiskSince: Partial<Record<AgentId, string>> = {}): MergeResult {
  if (!saved) return { day: fresh, changed: true };

  // Counting rules improved since this day was saved, and every agent that
  // has data for this day still has its logs on disk → the fresh day is the
  // more correct one, even if smaller. Keep saved git/github if fresh lacks them.
  const agentsInDay = new Set([...Object.keys(saved.agents), ...Object.keys(fresh.agents)] as AgentId[]);
  const allOnDisk = [...agentsInDay].every((id) => onDiskSince[id] !== undefined && onDiskSince[id]! <= fresh.date);
  if ((saved.algo ?? 0) < ALGO_VERSION && allOnDisk && agentsInDay.size > 0) {
    return { day: { ...fresh, git: fresh.git ?? saved.git, github: fresh.github ?? saved.github }, changed: true };
  }

  const out: DayRecord = structuredClone(saved);
  let changed = false;

  // --- per agent: keep the heavier version ---
  const agentIds = new Set([...Object.keys(saved.agents), ...Object.keys(fresh.agents)] as AgentId[]);
  for (const id of agentIds) {
    const s = saved.agents[id];
    const f = fresh.agents[id];
    if (f && heavier(agentDayWeight(f), agentDayWeight(s))) {
      out.agents[id] = f;
      changed = true;
    }
  }

  // --- day-level: element-wise max ---
  if (fresh.activeMinutes > out.activeMinutes) {
    out.activeMinutes = fresh.activeMinutes;
    changed = true;
  }
  for (let h = 0; h < 24; h++) {
    if ((fresh.hours[h] ?? 0) > (out.hours[h] ?? 0)) {
      out.hours[h] = fresh.hours[h];
      changed = true;
    }
  }
  const projects = new Map<string, ProjectDay>(out.projects.map((p) => [p.name, p]));
  for (const fp of fresh.projects) {
    const sp = projects.get(fp.name);
    if (!sp) {
      projects.set(fp.name, fp);
      changed = true;
    } else if (fp.minutes > sp.minutes || fp.sessions > sp.sessions) {
      projects.set(fp.name, {
        ...fp,
        agents: [...new Set([...sp.agents, ...fp.agents])].sort() as AgentId[],
        sessions: Math.max(sp.sessions, fp.sessions),
        minutes: Math.max(sp.minutes, fp.minutes),
        switches: Math.max(sp.switches, fp.switches),
      });
      changed = true;
    }
  }
  out.projects = [...projects.values()].sort((a, b) => b.minutes - a.minutes);
  for (const [k, v] of Object.entries(fresh.switches.pairs)) {
    if (v > (out.switches.pairs[k] ?? 0)) {
      out.switches.pairs[k] = v;
      changed = true;
    }
  }

  // --- git / github ---
  // More commits wins; with equal commits, more AI-matched commits wins (e.g.
  // a Codex branch match that was found later). Otherwise the saved one stays.
  if (
    fresh.git &&
    (!out.git ||
      fresh.git.commits > out.git.commits ||
      (fresh.git.commits === out.git.commits && aiTotal(fresh.git) > aiTotal(out.git)))
  ) {
    out.git = fresh.git;
    changed = true;
  }
  if (fresh.github) {
    const g = out.github ?? { prsMerged: 0, releases: 0, starsGained: 0 };
    const next = {
      prsMerged: Math.max(g.prsMerged, fresh.github.prsMerged),
      releases: Math.max(g.releases, fresh.github.releases),
      starsGained: Math.max(g.starsGained, fresh.github.starsGained),
    };
    if (JSON.stringify(next) !== JSON.stringify(out.github)) {
      out.github = next;
      changed = true;
    }
  }

  if (changed) {
    out.savedAt = fresh.savedAt;
    out.schemaVersion = fresh.schemaVersion;
  }
  return { day: out, changed };
}

function aiTotal(g: NonNullable<DayRecord["git"]>): number {
  return g.ai.claude + g.ai.codex.exact + g.ai.codex.branch + g.ai.codex.time + g.ai.copilot + g.ai.unknown;
}
