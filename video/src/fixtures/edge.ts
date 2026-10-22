// FAKE props built to break the layout on purpose: a whole year with long
// gaps, one agent only, 7-digit numbers, very long and emoji project names,
// no tool calls, nothing shipped, no hardest bug, no funny lines.
// The Samples/Rewynd-edge compositions render these so a layout bug shows
// up in Studio instead of in someone's posted video.

import type { RecapProps, Stats } from "../../../contract/recap";
import { REPO_URL, SCENE_ORDER } from "../../../contract/recap";
import { octoberProps, octoberStats } from "./october";

// 365 days of 2026. Jan–Jul have no saved history (rewynd wasn't installed
// yet), then heavy daily use.
const yearHeatmap: Stats["time"]["heatmap"] = Array.from({ length: 365 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 0, 1 + i));
  const date = d.toISOString().slice(0, 10);
  const saved = i >= 212 && i < 330;
  return { date, minutes: saved ? ((i * 37) % 600) + (i % 7 === 0 ? 0 : 60) : 0, saved };
});

const longName = "🚀 client-dashboard-super-long-project-name-v2-final-FINAL";

const edgeStats: Stats = {
  ...octoberStats,
  period: { kind: "year", label: "2026", tapeLabel: "2026", from: "2026-01-01", to: "2026-12-31" },
  coverage: { daysInPeriod: 365, daysSaved: 118, gapDays: 212, firstSavedDay: "2026-08-01", lastSavedDay: "2026-11-26" },
  agents: ["codex"],
  skippedAgents: [],
  totals: {
    sessions: 1_234_567,
    userMessages: 9_876_543,
    toolCalls: 2_345_678,
    tokensIn: 999_999_999,
    tokensOut: 88_888_888,
    activeMinutes: 1_234_567,
    activeHours: 20_576,
    activeDays: 118,
  },
  byAgent: {
    codex: { sessions: 1_234_567, userMessages: 9_876_543, toolCalls: 2_345_678, tokensIn: 999_999_999, tokensOut: 88_888_888, activeMinutes: 1_234_567 },
  },
  mainAgent: "codex",
  agentShare: [{ agent: "codex", share: 1, percent: 100 }],
  agentSwitches: { sameDay: 0, sameProject: 0, topSwitch: null },
  backgroundRuns: { total: 0, byAgent: {} },
  projects: [
    { name: longName, sessions: 812_345, minutes: 900_000, agents: ["codex"] },
    { name: "日本語のプロジェクト", sessions: 200_000, minutes: 200_000, agents: ["codex"] },
    { name: "a", sessions: 1, minutes: 1, agents: ["codex"] },
  ],
  tools: [],
  time: {
    ...octoberStats.time,
    busiestDay: { date: "2026-09-14", minutes: 659 },
    busiestHour: 23,
    lateNightSessions: 0,
    longestStreakDays: 1_234,
    heatmap: yearHeatmap,
  },
  phrases: { please: 0, thanks: 0, fixIt: 0, stillBroken: 0, why: 0, sorry: 0 },
  longestSession: { project: longName, agent: "codex", minutes: 1_440, date: "2026-09-14" },
  shipped: {
    commits: 0,
    aiCommits: 0,
    aiCommitsByAgent: { claude: 0, codex: 0, copilot: 0, unknown: 0 },
    codexConfidence: { exact: 0, branch: 0, time: 0 },
    aiShare: 0,
    linesAdded: 0,
    linesRemoved: 0,
    byRepo: [],
    biggestDay: null,
  },
};

export const edgeProps: RecapProps = {
  stats: edgeStats,
  story: {
    schemaVersion: 1,
    personality: {
      id: "weekend-warrior",
      title: "The Weekend Warrior",
      line: `Saturdays belong to ${longName}, and honestly so do most Sundays, mornings, and nights.`,
    },
    captions: {
      intro: "Your entire extremely long year of AI-assisted software development",
      hours: "That's more hours than there are in a normal person's patience, many times over.",
    },
    projects: [{ name: longName, line: "an extremely long one-liner that keeps going well past where it should stop" }],
    hardestBug: null,
    funnyLines: [],
    backgroundLine: null,
    closing: "This closing line is intentionally far too long to fit on one line so it has to wrap somewhere sensible.",
  },
  prefs: { ...octoberProps.prefs, theme: "bluescreen" },
  scenes: SCENE_ORDER,
  repoUrl: REPO_URL,
  customFontStaticPath: null,
  musicStaticPath: null,
};

// Same data, wide, light theme, project names hidden.
export const edgeWideProps: RecapProps = {
  ...edgeProps,
  prefs: { ...edgeProps.prefs, theme: "label", format: "wide", hideProjectNames: true },
};
