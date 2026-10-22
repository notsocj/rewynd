// =============================================================================
// store/build-days.ts — turn streamed sessions into per-day totals.
//
// Sessions arrive one at a time from the adapters. For each one we work out
// which minutes it was active, then drop those minutes into per-day buckets.
// At the end, every day becomes a DayRecord (store/day.ts).
//
// "Active minutes" — how long you actually worked, not how long a window sat
// open: we take every event (your messages, replies, tool calls), and any gap
// of up to IDLE_GAP_MIN between two events counts as working time. A longer
// gap means you walked away, so it isn't counted. Each minute is a number
// (minutes since 1970), and sets of them make overlaps trivial: two sessions
// running in parallel during the same minute still count as ONE minute of
// your time.
// =============================================================================

import type { AgentId, ToolCategory } from "../../contract/recap.ts";
import { local, localHHMM, timezone } from "../lib/time.ts";
import { countPhrases, emptyPhrases } from "../sources/phrases.ts";
import { projectOf } from "../sources/project-name.ts";
import type { Session } from "../sources/types.ts";
import { emptyBackground, emptyDay, type AgentDay, type DayRecord, type ProjectDay } from "./day.ts";

/** Gaps up to this long still count as working time. */
export const IDLE_GAP_MIN = 15;
/**
 * Agent activity only counts while it's working on something you asked
 * recently: up to this many minutes after your last message. Without this, an
 * agent left looping overnight would add hours you never spent.
 */
export const ANCHOR_MIN = 60;

type AgentAcc = AgentDay & { minuteSet: Set<number> };
type ProjectAcc = { name: string; minutes: Set<number>; sessions: number; agents: Set<AgentId>; starts: { at: number; agent: AgentId }[] };
type DayAcc = {
  agents: Map<AgentId, AgentAcc>;
  minutes: Set<number>;
  projects: Map<string, ProjectAcc>;
  /** Human session starts, for counting agent switches within the day. */
  starts: { at: number; agent: AgentId }[];
};

/**
 * Minutes (epoch-minute numbers) a session was active:
 *   1. drop events more than ANCHOR_MIN after your most recent message
 *   2. join the rest into blocks, splitting wherever the gap > IDLE_GAP_MIN
 * `userTimes` = when you sent messages (empty = no anchoring, e.g. tests).
 */
export function activeMinutesOf(times: number[], userTimes: number[] = []): number[] {
  let sorted = [...times].sort((a, b) => a - b);
  if (userTimes.length) {
    const users = [...userTimes].sort((a, b) => a - b);
    let u = -1;
    sorted = sorted.filter((t) => {
      while (u + 1 < users.length && users[u + 1] <= t) u++;
      return u >= 0 && t - users[u] <= ANCHOR_MIN * 60000;
    });
  }
  if (!sorted.length) return [];
  const out = new Set<number>();
  let blockStart = sorted[0];
  let prev = sorted[0];
  const flush = (a: number, b: number) => {
    for (let m = Math.floor(a / 60000); m <= Math.floor(b / 60000); m++) out.add(m);
  };
  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i];
    if (t - prev > IDLE_GAP_MIN * 60000) {
      flush(blockStart, prev);
      blockStart = t;
    }
    prev = t;
  }
  flush(blockStart, prev);
  return [...out];
}

export class DayBuilder {
  private days = new Map<string, DayAcc>();

  private day(date: string): DayAcc {
    let d = this.days.get(date);
    if (!d) {
      d = { agents: new Map(), minutes: new Set(), projects: new Map(), starts: [] };
      this.days.set(date, d);
    }
    return d;
  }

  private agent(date: string, id: AgentId): AgentAcc {
    const d = this.day(date);
    let a = d.agents.get(id);
    if (!a) {
      a = {
        sessions: 0, userMessages: 0, assistantMessages: 0, toolCalls: 0, tokensIn: 0, tokensOut: 0,
        activeMinutes: 0, models: {}, tools: {}, lateNightSessions: 0, longestSession: null,
        phrases: emptyPhrases(), automated: emptyBackground(), minuteSet: new Set(),
      };
      d.agents.set(id, a);
    }
    return a;
  }

  /** Add one session. Returns its active-minute count (handy for callers). */
  add(s: Session): number {
    const times = [...s.messages.map((m) => m.at), ...s.toolCalls.map((t) => t.at), ...s.usage.map((u) => u.at)];
    if (!times.length) return 0;
    // A loop, not Math.min(...times): huge sessions can have 100k+ events,
    // which is too many arguments for a spread.
    let start = Infinity;
    for (const t of times) if (t < start) start = t;
    const startDate = local(start).date;

    // Background runs: count them on their start day, nothing else.
    if (s.origin === "automated") {
      this.agent(startDate, s.agent).automated[s.automatedKind ?? "other"]++;
      return 0;
    }

    const project = projectOf(s.cwd)?.name ?? "unknown project";
    const minutes = activeMinutesOf(times, s.messages.filter((m) => m.role === "user").map((m) => m.at));

    // --- once per session, on the day it started ---
    const a0 = this.agent(startDate, s.agent);
    a0.sessions++;
    if (local(start).hour < 5) a0.lateNightSessions++;
    if (!a0.longestSession || minutes.length > a0.longestSession.minutes) {
      a0.longestSession = { project, minutes: minutes.length };
    }
    const d0 = this.day(startDate);
    d0.starts.push({ at: start, agent: s.agent });
    const p0 = this.projectAcc(startDate, project);
    p0.sessions++;
    p0.agents.add(s.agent);
    p0.starts.push({ at: start, agent: s.agent });

    // --- per event, on the day it happened ---
    for (const m of s.messages) {
      const a = this.agent(local(m.at).date, s.agent);
      if (m.role === "user") {
        a.userMessages++;
        if (m.text) countPhrases(m.text, a.phrases);
      } else {
        a.assistantMessages++;
        if (m.model) a.models[m.model] = (a.models[m.model] ?? 0) + 1;
      }
    }
    for (const t of s.toolCalls) {
      const a = this.agent(local(t.at).date, s.agent);
      a.toolCalls++;
      a.tools[t.category as ToolCategory] = (a.tools[t.category as ToolCategory] ?? 0) + 1;
    }
    for (const u of s.usage) {
      const a = this.agent(local(u.at).date, s.agent);
      a.tokensIn += u.tokensIn;
      a.tokensOut += u.tokensOut;
    }

    // --- per active minute ---
    for (const min of minutes) {
      const date = local(min * 60000).date;
      this.agent(date, s.agent).minuteSet.add(min);
      this.day(date).minutes.add(min);
      const p = this.projectAcc(date, project);
      p.minutes.add(min);
      p.agents.add(s.agent);
    }
    return minutes.length;
  }

  private projectAcc(date: string, name: string): ProjectAcc {
    const d = this.day(date);
    let p = d.projects.get(name);
    if (!p) {
      p = { name, minutes: new Set(), sessions: 0, agents: new Set(), starts: [] };
      d.projects.set(name, p);
    }
    return p;
  }

  /** Finish: one DayRecord per date that had any activity. */
  build(): DayRecord[] {
    const out: DayRecord[] = [];
    for (const [date, d] of [...this.days.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const rec = emptyDay(date, timezone());
      for (const [id, acc] of d.agents) {
        const { minuteSet, ...agentDay } = acc;
        agentDay.activeMinutes = minuteSet.size;
        rec.agents[id] = agentDay;
      }
      rec.activeMinutes = d.minutes.size;
      for (const min of d.minutes) rec.hours[local(min * 60000).hour]++;

      // Agent switches: consecutive human sessions (by start time) by different agents.
      const starts = [...d.starts].sort((x, y) => x.at - y.at);
      for (let i = 1; i < starts.length; i++) {
        if (starts[i].agent !== starts[i - 1].agent) {
          const key = `${starts[i - 1].agent}>${starts[i].agent}`;
          rec.switches.pairs[key] = (rec.switches.pairs[key] ?? 0) + 1;
        }
      }

      for (const p of d.projects.values()) {
        const mins = [...p.minutes].sort((x, y) => x - y);
        const ps = [...p.starts].sort((x, y) => x.at - y.at);
        let switches = 0;
        for (let i = 1; i < ps.length; i++) if (ps[i].agent !== ps[i - 1].agent) switches++;
        const fallbackAgent = [...p.agents][0];
        const proj: ProjectDay = {
          name: p.name,
          agents: [...p.agents].sort(),
          sessions: p.sessions,
          minutes: mins.length,
          firstAt: mins.length ? localHHMM(mins[0] * 60000) : "00:00",
          lastAt: mins.length ? localHHMM(mins[mins.length - 1] * 60000) : "00:00",
          firstAgent: ps[0]?.agent ?? fallbackAgent,
          lastAgent: ps[ps.length - 1]?.agent ?? fallbackAgent,
          switches,
        };
        rec.projects.push(proj);
      }
      rec.projects.sort((x, y) => y.minutes - x.minutes);
      out.push(rec);
    }
    return out;
  }
}
