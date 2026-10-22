// FAKE props for previews and samples: one invented month of a busy
// two-agent developer. Project names and numbers are made up but realistic,
// so the layout is tested against the sizes real data will have.
//
// The real props come from output/props.json, written by scripts/render.ts.

import type { RecapProps, Stats, Story } from "../../../contract/recap";
import { DEFAULT_PREFS, REPO_URL, SCENE_ORDER } from "../../../contract/recap";

// Minutes per day for Oct 1–22 (sums to 5,172 = 86h 12m; Oct 21 is the peak).
const octoberMinutes = [
  132, 180, 240, 120, 90, 300, 270, 180, 120, 240, 330, 180, 96, 240, 210, 300, 240, 150, 180, 360, 660, 354,
];

// One heatmap entry per day of October. Oct 23–31 haven't happened yet, so
// they have no saved day file: `saved: false` (drawn as "no tape", not zero).
const heatmap: Stats["time"]["heatmap"] = Array.from({ length: 31 }, (_, i) => {
  const date = `2026-10-${String(i + 1).padStart(2, "0")}`;
  return i < octoberMinutes.length
    ? { date, minutes: octoberMinutes[i], saved: true }
    : { date, minutes: 0, saved: false };
});

export const octoberStats: Stats = {
  schemaVersion: 1,
  generatedAt: "2026-10-22T09:00:00Z",
  timezone: "UTC",
  period: {
    kind: "month",
    label: "October 2026",
    tapeLabel: "OCTOBER '26",
    from: "2026-10-01",
    to: "2026-10-31",
  },
  coverage: {
    daysInPeriod: 31,
    daysSaved: 22,
    gapDays: 0,
    firstSavedDay: "2026-10-01",
    lastSavedDay: "2026-10-22",
  },
  agents: ["claude-code", "codex"],
  skippedAgents: [{ id: "cursor", reason: "Found on this machine, but Cursor support isn't built yet." }],
  totals: {
    sessions: 302,
    userMessages: 2410,
    toolCalls: 3727,
    tokensIn: 48_210_000,
    tokensOut: 1_920_000,
    activeMinutes: 5172,
    activeHours: 86.2,
    activeDays: 22,
  },
  byAgent: {
    "claude-code": { sessions: 188, userMessages: 1530, toolCalls: 2390, tokensIn: 31_400_000, tokensOut: 1_210_000, activeMinutes: 3207 },
    codex: { sessions: 114, userMessages: 880, toolCalls: 1337, tokensIn: 16_810_000, tokensOut: 710_000, activeMinutes: 1965 },
  },
  mainAgent: "claude-code",
  agentShare: [
    { agent: "claude-code", share: 0.62, percent: 62 },
    { agent: "codex", share: 0.38, percent: 38 },
  ],
  agentSwitches: {
    sameDay: 17,
    sameProject: 41,
    topSwitch: { from: "claude-code", to: "codex", count: 41 },
  },
  backgroundRuns: {
    total: 999,
    byAgent: {
      codex: { review: 702, subagent: 0, other: 0 },
      "claude-code": { review: 0, subagent: 297, other: 0 },
    },
  },
  projects: [
    { name: "harbor-api", sessions: 96, minutes: 1720, agents: ["claude-code", "codex"] },
    { name: "lumen", sessions: 71, minutes: 1180, agents: ["claude-code", "codex"] },
    { name: "fernpost", sessions: 58, minutes: 940, agents: ["claude-code"] },
    { name: "rewynd", sessions: 34, minutes: 610, agents: ["claude-code"] },
    { name: "pocket-garden", sessions: 22, minutes: 420, agents: ["codex"] },
    { name: "quillmark", sessions: 21, minutes: 302, agents: ["claude-code", "codex"] },
  ],
  tools: [
    { category: "edit", label: "Edit files", count: 1240 },
    { category: "run", label: "Run commands", count: 1015 },
    { category: "read", label: "Read files", count: 860 },
    { category: "search", label: "Search", count: 342 },
    { category: "delegate", label: "Hand off to helpers", count: 128 },
    { category: "web", label: "Browse the web", count: 64 },
    { category: "plan", label: "Make plans", count: 41 },
    { category: "mcp", label: "Use connected apps", count: 22 },
    { category: "other", label: "Other tools", count: 15 },
  ],
  models: [
    { name: "claude-opus-5-5", count: 1410, share: 0.52 },
    { name: "gpt-5.5-codex", count: 1030, share: 0.38 },
    { name: "claude-sonnet-5-5", count: 270, share: 0.1 },
  ],
  time: {
    busiestDay: { date: "2026-10-21", minutes: 660 },
    busiestHour: 2,
    hours: [300, 280, 610, 330, 150, 60, 20, 10, 15, 40, 90, 140, 180, 170, 210, 260, 250, 220, 240, 280, 300, 330, 360, 327],
    weekdays: [820, 760, 880, 790, 700, 640, 582],
    lateNightSessions: 64,
    longestStreakDays: 22,
    heatmap,
  },
  phrases: { please: 212, thanks: 168, fixIt: 94, stillBroken: 37, why: 121, sorry: 9 },
  longestSession: { project: "harbor-api", agent: "claude-code", minutes: 312, date: "2026-10-21" },
  personalityHints: [
    { id: "3am-shipper", score: 0.82, reason: "24% of active minutes were between midnight and 5AM." },
    { id: "juggler", score: 0.64, reason: "6 projects across 2 agents." },
    { id: "polite-one", score: 0.41, reason: "212 pleases and 168 thanks." },
  ],
  shipped: {
    commits: 641,
    aiCommits: 512,
    aiCommitsByAgent: { claude: 366, codex: 131, copilot: 0, unknown: 15 },
    codexConfidence: { exact: 82, branch: 29, time: 20 },
    aiShare: 512 / 641,
    linesAdded: 17_486,
    linesRemoved: 6_512,
    byRepo: [
      { name: "harbor-api", commits: 128, aiCommits: 112, linesAdded: 4030, linesRemoved: 1310 },
      { name: "lumen", commits: 91, aiCommits: 76, linesAdded: 2980, linesRemoved: 1215 },
      { name: "fernpost", commits: 77, aiCommits: 64, linesAdded: 2540, linesRemoved: 870 },
      { name: "rewynd", commits: 61, aiCommits: 58, linesAdded: 2380, linesRemoved: 240 },
      { name: "pocket-garden", commits: 49, aiCommits: 37, linesAdded: 1420, linesRemoved: 590 },
    ],
    biggestDay: { date: "2026-10-21", commits: 38 },
  },
};

export const octoberStory: Story = {
  schemaVersion: 1,
  personality: {
    id: "3am-shipper",
    title: "The 3AM Shipper",
    line: "Your best commits happen after midnight. Sleep is a suggestion.",
  },
  captions: {
    hours: "That's 3.6 days of pair programming.",
    peakHour: "64 sessions started after midnight.",
  },
  projects: [
    { name: "harbor-api", line: "mostly taming the rate limiter" },
    { name: "lumen", line: "auth, auth, and more auth" },
    { name: "fernpost", line: "rebuilding the RSS importer" },
  ],
  hardestBug: {
    project: "lumen",
    line: "A login loop that only broke on Safari, 31 messages deep.",
  },
  funnyLines: [
    "You said “still broken” 37 times.",
    "You said please 212 times. The AI noticed.",
    "You asked “why” 121 times. Fair.",
  ],
  backgroundLine: "Codex double-checked itself 702 times.",
  closing: "Same time next month? The tape's still rolling.",
};

export const octoberProps: RecapProps = {
  stats: octoberStats,
  story: octoberStory,
  prefs: { ...DEFAULT_PREFS, theme: "night" },
  scenes: SCENE_ORDER,
  repoUrl: REPO_URL,
  customFontStaticPath: null,
  musicStaticPath: null,
};
