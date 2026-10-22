// =============================================================================
// stats/build-stats.ts — saved days → stats.json for one period.
//
// stats.json is built ONLY from data/days/, never straight from transcripts.
// That's what lets October stay complete after Claude Code deletes October's
// transcripts in November.
//
// Every number in here is a real count. Claude's story must only use numbers
// that appear in this file (story/validate-story.ts checks that).
// =============================================================================

import {
  TOOL_LABELS,
  type AgentId,
  type AgentTotals,
  type BackgroundCounts,
  type Period,
  type Shipped,
  type Stats,
  type ToolCategory,
} from "../../contract/recap.ts";
import { eachDate, timezone, today, weekdayOf } from "../lib/time.ts";
import { emptyPhrases, addPhrases } from "../sources/phrases.ts";
import type { DayRecord } from "../store/day.ts";
import { isCovered, type Coverage } from "../store/coverage.ts";
import { rankPersonalities } from "./personality.ts";

export type BuildInput = {
  period: Period;
  days: Map<string, DayRecord>;
  coverage: Coverage;
  skippedAgents: Stats["skippedAgents"];
  /** True when this run fetched GitHub numbers (--github). */
  includeGithub: boolean;
};

const zeroTotals = (): AgentTotals => ({ sessions: 0, userMessages: 0, toolCalls: 0, tokensIn: 0, tokensOut: 0, activeMinutes: 0 });

export function buildStats({ period, days, coverage, skippedAgents, includeGithub }: BuildInput): Stats {
  // A month in progress ends "today" for coverage and heatmap purposes:
  // tomorrow isn't a gap, it just hasn't happened yet.
  const lastDay = period.to < today() ? period.to : today();
  const dates = period.from <= lastDay ? eachDate(period.from, lastDay) : [];
  const inPeriod = dates.map((d) => days.get(d)).filter((d): d is DayRecord => !!d);

  // ---------------- per agent ----------------
  const byAgent: Partial<Record<AgentId, AgentTotals>> = {};
  const background: Partial<Record<AgentId, BackgroundCounts>> = {};
  const tools: Partial<Record<ToolCategory, number>> = {};
  const models: Record<string, number> = {};
  let phrases = emptyPhrases();
  let lateNight = 0;
  let longest: Stats["longestSession"] = null;

  for (const day of inPeriod) {
    for (const [id, a] of Object.entries(day.agents) as [AgentId, NonNullable<DayRecord["agents"][AgentId]>][]) {
      const t = (byAgent[id] ??= zeroTotals());
      t.sessions += a.sessions;
      t.userMessages += a.userMessages;
      t.toolCalls += a.toolCalls;
      t.tokensIn += a.tokensIn;
      t.tokensOut += a.tokensOut;
      t.activeMinutes += a.activeMinutes;
      const bg = (background[id] ??= { review: 0, subagent: 0, other: 0 });
      bg.review += a.automated.review;
      bg.subagent += a.automated.subagent;
      bg.other += a.automated.other;
      for (const [c, n] of Object.entries(a.tools)) tools[c as ToolCategory] = (tools[c as ToolCategory] ?? 0) + (n ?? 0);
      for (const [m, n] of Object.entries(a.models)) models[m] = (models[m] ?? 0) + n;
      phrases = addPhrases(phrases, a.phrases);
      lateNight += a.lateNightSessions;
      if (a.longestSession && (!longest || a.longestSession.minutes > longest.minutes)) {
        longest = { ...a.longestSession, agent: id, date: day.date };
      }
    }
  }

  // Only agents you actually used by hand count as "your" agents.
  const agents = (Object.keys(byAgent) as AgentId[])
    .filter((id) => (byAgent[id]!.sessions > 0 || byAgent[id]!.userMessages > 0))
    .sort((a, b) => byAgent[b]!.activeMinutes - byAgent[a]!.activeMinutes);
  for (const id of Object.keys(byAgent) as AgentId[]) if (!agents.includes(id)) delete byAgent[id];

  // ---------------- totals ----------------
  const totals = zeroTotals();
  for (const id of agents) {
    const t = byAgent[id]!;
    totals.sessions += t.sessions;
    totals.userMessages += t.userMessages;
    totals.toolCalls += t.toolCalls;
    totals.tokensIn += t.tokensIn;
    totals.tokensOut += t.tokensOut;
  }
  // Day-level minutes count parallel sessions of different agents once.
  totals.activeMinutes = inPeriod.reduce((a, d) => a + d.activeMinutes, 0);
  const activeDays = inPeriod.filter((d) => d.activeMinutes > 0).length;

  // ---------------- main AI + shares ----------------
  const agentMinutes = agents.map((id) => byAgent[id]!.activeMinutes);
  const shareBase = agentMinutes.reduce((a, b) => a + b, 0) || 1;
  const percents = roundToHundred(agentMinutes.map((m) => (m / shareBase) * 100));
  const agentShare = agents.map((agent, i) => ({ agent, share: round(agentMinutes[i] / shareBase, 3), percent: percents[i] }));

  // ---------------- switches ----------------
  const pairs: Record<string, number> = {};
  let sameDay = 0;
  let sameProject = 0;
  const lastAgentOfProject = new Map<string, AgentId>();
  for (const day of inPeriod) {
    const used = (Object.keys(day.agents) as AgentId[]).filter((id) => (day.agents[id]?.sessions ?? 0) > 0 || (day.agents[id]?.activeMinutes ?? 0) > 0);
    if (used.length >= 2) sameDay++;
    for (const [k, v] of Object.entries(day.switches.pairs)) pairs[k] = (pairs[k] ?? 0) + v;
    for (const p of day.projects) {
      sameProject += p.switches;
      const prev = lastAgentOfProject.get(p.name);
      if (prev && p.firstAgent && prev !== p.firstAgent) sameProject++; // switched between days
      if (p.lastAgent) lastAgentOfProject.set(p.name, p.lastAgent);
    }
  }
  const top = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0];
  const topSwitch = top ? { from: top[0].split(">")[0] as AgentId, to: top[0].split(">")[1] as AgentId, count: top[1] } : null;

  // ---------------- projects / tools / models ----------------
  const projAcc = new Map<string, { name: string; sessions: number; minutes: number; agents: Set<AgentId> }>();
  for (const day of inPeriod) {
    for (const p of day.projects) {
      const acc = projAcc.get(p.name) ?? { name: p.name, sessions: 0, minutes: 0, agents: new Set<AgentId>() };
      acc.sessions += p.sessions;
      acc.minutes += p.minutes;
      p.agents.forEach((a) => acc.agents.add(a));
      projAcc.set(p.name, acc);
    }
  }
  const projects = [...projAcc.values()]
    .filter((p) => p.minutes > 0 || p.sessions > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10)
    .map((p) => ({ name: p.name, sessions: p.sessions, minutes: p.minutes, agents: [...p.agents].sort() }));

  const toolList = (Object.entries(tools) as [ToolCategory, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, label: TOOL_LABELS[category], count }));

  const modelTotal = Object.values(models).reduce((a, b) => a + b, 0) || 1;
  const modelList = Object.entries(models)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, share: round(count / modelTotal, 3) }));

  // ---------------- time ----------------
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  for (const d of inPeriod) {
    d.hours.forEach((m, h) => (hours[h] += m));
    weekdays[weekdayOf(d.date)] += d.activeMinutes;
  }
  const busiest = inPeriod.reduce<DayRecord | null>((best, d) => (!best || d.activeMinutes > best.activeMinutes ? d : best), null);
  const peakHour = hours.some((m) => m > 0) ? hours.indexOf(Math.max(...hours)) : null;
  let streak = 0;
  let longestStreak = 0;
  for (const date of dates) {
    streak = (days.get(date)?.activeMinutes ?? 0) > 0 ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
  }
  const heatmap = dates.map((date) => ({
    date,
    minutes: days.get(date)?.activeMinutes ?? 0,
    saved: days.has(date) || isCovered(coverage, date),
  }));

  // ---------------- background runs ----------------
  const bgByAgent: Partial<Record<AgentId, BackgroundCounts>> = {};
  let bgTotal = 0;
  for (const [id, bg] of Object.entries(background) as [AgentId, BackgroundCounts][]) {
    const n = bg.review + bg.subagent + bg.other;
    if (n) {
      bgByAgent[id] = bg;
      bgTotal += n;
    }
  }

  const savedDays = dates.filter((d) => days.has(d));
  const base: Omit<Stats, "personalityHints"> = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    timezone: timezone(),
    period,
    coverage: {
      daysInPeriod: dates.length,
      daysSaved: savedDays.length,
      gapDays: heatmap.filter((h) => !h.saved).length,
      firstSavedDay: savedDays[0] ?? null,
      lastSavedDay: savedDays[savedDays.length - 1] ?? null,
    },
    agents,
    skippedAgents,
    totals: { ...totals, activeHours: round(totals.activeMinutes / 60, 1), activeDays },
    byAgent,
    mainAgent: agents[0] ?? null,
    agentShare,
    agentSwitches: { sameDay, sameProject, topSwitch },
    backgroundRuns: { total: bgTotal, byAgent: bgByAgent },
    projects,
    tools: toolList,
    models: modelList,
    time: {
      busiestDay: busiest && busiest.activeMinutes > 0 ? { date: busiest.date, minutes: busiest.activeMinutes } : null,
      busiestHour: peakHour,
      hours,
      weekdays,
      lateNightSessions: lateNight,
      longestStreakDays: longestStreak,
      heatmap,
    },
    phrases,
    longestSession: longest,
    shipped: buildShipped(inPeriod, includeGithub),
  };
  return { ...base, personalityHints: rankPersonalities(base) };
}

function buildShipped(days: DayRecord[], includeGithub: boolean): Shipped | null {
  const withGit = days.filter((d) => d.git && d.git.commits > 0);
  if (!withGit.length) return null;
  const s: Shipped = {
    commits: 0,
    aiCommits: 0,
    aiCommitsByAgent: { claude: 0, codex: 0, copilot: 0, unknown: 0 },
    codexConfidence: { exact: 0, branch: 0, time: 0 },
    aiShare: 0,
    linesAdded: 0,
    linesRemoved: 0,
    byRepo: [],
    biggestDay: null,
  };
  const repos = new Map<string, Shipped["byRepo"][number]>();
  for (const d of withGit) {
    const g = d.git!;
    s.commits += g.commits;
    s.linesAdded += g.linesAdded;
    s.linesRemoved += g.linesRemoved;
    s.aiCommitsByAgent.claude += g.ai.claude;
    s.aiCommitsByAgent.copilot += g.ai.copilot;
    s.aiCommitsByAgent.unknown += g.ai.unknown;
    s.codexConfidence.exact += g.ai.codex.exact;
    s.codexConfidence.branch += g.ai.codex.branch;
    s.codexConfidence.time += g.ai.codex.time;
    if (!s.biggestDay || g.commits > s.biggestDay.commits) s.biggestDay = { date: d.date, commits: g.commits };
    for (const [name, r] of Object.entries(g.repos)) {
      const acc = repos.get(name) ?? { name, commits: 0, aiCommits: 0, linesAdded: 0, linesRemoved: 0 };
      acc.commits += r.commits;
      acc.aiCommits += r.ai;
      acc.linesAdded += r.linesAdded;
      acc.linesRemoved += r.linesRemoved;
      repos.set(name, acc);
    }
  }
  s.aiCommitsByAgent.codex = s.codexConfidence.exact + s.codexConfidence.branch + s.codexConfidence.time;
  s.aiCommits = s.aiCommitsByAgent.claude + s.aiCommitsByAgent.codex + s.aiCommitsByAgent.copilot + s.aiCommitsByAgent.unknown;
  s.aiShare = round(s.aiCommits / (s.commits || 1), 3);
  s.byRepo = [...repos.values()].sort((a, b) => b.commits - a.commits).slice(0, 10);
  if (includeGithub) {
    s.github = { prsMerged: 0, releases: 0, starsGained: 0 };
    for (const d of days) {
      if (!d.github) continue;
      s.github.prsMerged += d.github.prsMerged;
      s.github.releases += d.github.releases;
      s.github.starsGained += d.github.starsGained;
    }
  }
  return s;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Round percentages so they add up to exactly 100 (largest remainders win). */
export function roundToHundred(values: number[]): number[] {
  if (!values.length) return [];
  const floors = values.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = values.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors;
}
