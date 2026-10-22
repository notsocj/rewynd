// =============================================================================
// contract/recap.ts — THE shared contract between rewynd's two halves.
//
//   scripts/  (Node)      writes  output/stats.json   (numbers, 0 tokens)
//   Claude    (skill)     writes  output/story.json   (words, small input)
//   scripts/render.ts     merges them + design prefs → output/props.json
//   video/    (Remotion)  reads   props.json as <Rewynd> / <RewyndCard> props
//
// Both sides import these types, so if one side changes a field, TypeScript
// complains on the other side instead of the video silently showing "undefined".
//
// Rules for this file:
// - Types plus a few small constant tables only. No Node or browser APIs,
//   because it's imported by Node (scripts) AND by the Remotion bundle (video).
// - Node runs .ts files directly by stripping types, so: no `enum`, no
//   `namespace`, no constructor parameter properties. Plain unions + objects.
// =============================================================================

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

/** Every AI coding agent rewynd knows about (some are detect-only for now). */
export type AgentId =
  | "claude-code"
  | "codex"
  | "gemini"
  | "opencode"
  | "cursor"
  | "antigravity";

/** Plain-text display names. We never show agent logos (trademarks). */
export const AGENT_LABELS: Record<AgentId, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
  cursor: "Cursor",
  antigravity: "Antigravity",
};

// ---------------------------------------------------------------------------
// Tools — agent-neutral categories
// ---------------------------------------------------------------------------
// Each agent names its tools differently (Claude Code "Edit", Codex
// "apply_patch", Gemini "replace"...). Adapters map them into these buckets
// so the video can say "Edit files" no matter which agent did the work.

export type ToolCategory =
  | "edit"
  | "run"
  | "read"
  | "search"
  | "web"
  | "delegate"
  | "plan"
  | "mcp"
  | "other";

export const TOOL_LABELS: Record<ToolCategory, string> = {
  edit: "Edit files",
  run: "Run commands",
  read: "Read files",
  search: "Search",
  web: "Browse the web",
  delegate: "Hand off to helpers",
  plan: "Make plans",
  mcp: "Use connected apps",
  other: "Other tools",
};

// ---------------------------------------------------------------------------
// stats.json — written by scripts/stats/build-stats.ts from saved days
// ---------------------------------------------------------------------------

/** Totals for one agent inside the period (human sessions only). */
export type AgentTotals = {
  sessions: number;
  userMessages: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  activeMinutes: number;
};

/** Background runs (automatic reviews, sub-agents...). Never in human totals; only feed a joke line. */
export type BackgroundCounts = { review: number; subagent: number; other: number };

export type Period = {
  kind: "month" | "year" | "custom";
  /** Human label, e.g. "October 2026" or "2026". */
  label: string;
  /** Cassette-label style, e.g. "OCTOBER '26" or "2026". */
  tapeLabel: string;
  /** Inclusive local dates, YYYY-MM-DD. */
  from: string;
  to: string;
};

export type Shipped = {
  /** Your commits that reached the default branch (merges excluded). */
  commits: number;
  /** Commits made with any AI (Claude trailer, Copilot co-author, Codex match tiers). */
  aiCommits: number;
  aiCommitsByAgent: { claude: number; codex: number; copilot: number; unknown: number };
  /** How sure we are about the Codex count: exact hash / codex/* branch / time+repo match. */
  codexConfidence: { exact: number; branch: number; time: number };
  /** aiCommits / commits, 0–1. */
  aiShare: number;
  /** After the noise filter (lockfiles, build output, minified, binaries...). */
  linesAdded: number;
  linesRemoved: number;
  byRepo: { name: string; commits: number; aiCommits: number; linesAdded: number; linesRemoved: number }[];
  biggestDay: { date: string; commits: number } | null;
  /** Only present when the user ran with --github. */
  github?: { prsMerged: number; releases: number; starsGained: number };
};

export type PersonalityId =
  | "3am-shipper"
  | "rewriter"
  | "polite-one"
  | "speedrunner"
  | "bug-whisperer"
  | "architect"
  | "juggler"
  | "marathoner"
  | "weekend-warrior";

/** The fixed personality list. Claude picks one; the script suggests a ranking. */
export const PERSONALITIES: Record<PersonalityId, { title: string; hint: string }> = {
  "3am-shipper": { title: "The 3AM Shipper", hint: "Lots of activity between midnight and 5AM." },
  rewriter: { title: "The Rewriter", hint: "Edits far outnumber everything else; lines removed are high." },
  "polite-one": { title: "The Polite One", hint: "Says please and thanks to the AI a lot." },
  speedrunner: { title: "The Speedrunner", hint: "Many short sessions, quick in and out." },
  "bug-whisperer": { title: "The Bug Whisperer", hint: "Lots of 'fix it', 'still broken', 'why'." },
  architect: { title: "The Architect", hint: "Reads and searches more than edits; plans first." },
  juggler: { title: "The Juggler", hint: "Many projects and/or several agents in parallel." },
  marathoner: { title: "The Marathoner", hint: "Long sessions, few breaks." },
  "weekend-warrior": { title: "The Weekend Warrior", hint: "A big share of activity on Saturdays and Sundays." },
};

export type Stats = {
  schemaVersion: 1;
  generatedAt: string;
  /** IANA timezone used for every day/hour bucket, e.g. "Europe/Berlin". */
  timezone: string;
  period: Period;
  /** How complete the saved history is for this period (honesty about gaps). */
  coverage: {
    daysInPeriod: number;
    /** Days in the period that have a saved day file. */
    daysSaved: number;
    /** Past days in the period with no saved file (rewynd wasn't run within the agent's retention window). */
    gapDays: number;
    firstSavedDay: string | null;
    lastSavedDay: string | null;
  };
  /** Agents with at least one human session in the period. */
  agents: AgentId[];
  /** Agents found on the machine but not included, with a plain-language reason. */
  skippedAgents: { id: AgentId; reason: string }[];
  totals: AgentTotals & { activeHours: number; activeDays: number };
  byAgent: Partial<Record<AgentId, AgentTotals>>;
  mainAgent: AgentId | null;
  /** Share of human active minutes; `percent` values are rounded to sum to 100. */
  agentShare: { agent: AgentId; share: number; percent: number }[];
  agentSwitches: {
    /** Days where 2+ agents were used. */
    sameDay: number;
    /** Times a project moved from one agent to another (consecutive human sessions). */
    sameProject: number;
    topSwitch: { from: AgentId; to: AgentId; count: number } | null;
  };
  backgroundRuns: { total: number; byAgent: Partial<Record<AgentId, BackgroundCounts>> };
  /** Top projects by active minutes (max 10). Names may be hidden later by prefs. */
  projects: { name: string; sessions: number; minutes: number; agents: AgentId[] }[];
  /** Tool use by category, most used first. */
  tools: { category: ToolCategory; label: string; count: number }[];
  models: { name: string; count: number; share: number }[];
  time: {
    busiestDay: { date: string; minutes: number } | null;
    /** 0–23 local hour with the most active minutes. */
    busiestHour: number | null;
    /** Active minutes per local hour, 24 values. */
    hours: number[];
    /** Active minutes per weekday, Monday first, 7 values. */
    weekdays: number[];
    /** Human sessions that started between 00:00 and 04:59. */
    lateNightSessions: number;
    longestStreakDays: number;
    /** One entry per day in the period, in order. `saved: false` = gap, not zero activity. */
    heatmap: { date: string; minutes: number; saved: boolean }[];
  };
  phrases: { please: number; thanks: number; fixIt: number; stillBroken: number; why: number; sorry: number };
  longestSession: { project: string; agent: AgentId; minutes: number; date: string } | null;
  /** Ranked suggestion for the personality, computed from the numbers above. */
  personalityHints: { id: PersonalityId; score: number; reason: string }[];
  /** null when git found no repos / no commits in the period. */
  shipped: Shipped | null;
};

// ---------------------------------------------------------------------------
// story.json — written by Claude (see skills/rewynd/SKILL.md), validated by
// scripts/story/validate-story.ts before rendering.
// ---------------------------------------------------------------------------

export type SceneId =
  | "intro"
  | "hours"
  | "mainAI"
  | "heatmap"
  | "peakHour"
  | "projects"
  | "tools"
  | "shipped"
  | "funny"
  | "hardestBug"
  | "personality"
  | "outro";

/** Canonical scene order. render.ts drops scenes that have nothing to show. */
export const SCENE_ORDER: SceneId[] = [
  "intro",
  "hours",
  "mainAI",
  "heatmap",
  "peakHour",
  "projects",
  "tools",
  "shipped",
  "funny",
  "hardestBug",
  "personality",
  "outro",
];

export type Story = {
  schemaVersion: 1;
  personality: {
    id: PersonalityId;
    /** Usually PERSONALITIES[id].title; Claude may keep it as-is. */
    title: string;
    /** One playful sentence, ≤ 90 chars. */
    line: string;
  };
  /** Short caption per scene (≤ 60 chars, readable in ~2 seconds). Missing = scene default text. */
  captions: Partial<Record<SceneId, string>>;
  /** Up to 3 top projects with one line each ("lumen: mostly fighting auth"). */
  projects: { name: string; line: string }[];
  hardestBug: { project: string | null; line: string } | null;
  /** 1–3 lines, every number must exist in stats.json. */
  funnyLines: string[];
  /** Optional joke built from backgroundRuns ("Codex double-checked itself 756 times"). */
  backgroundLine: string | null;
  /** Last words on the outro card. */
  closing: string;
};

// ---------------------------------------------------------------------------
// Design preferences — asked before rendering, saved in data/preferences.json
// ---------------------------------------------------------------------------

export type DesignPrefs = {
  /** A theme id from video/src/themes.json, or "auto" (picked from the personality). */
  theme: string;
  font: { kind: "inter" } | { kind: "custom"; file: string };
  format: "vertical" | "wide" | "both";
  /** Replace project/repo names with "Project A/B/C" in the video. */
  hideProjectNames: boolean;
  /** Optional user-supplied audio file (absolute path). We never ship music. */
  musicFile: string | null;
};

export const DEFAULT_PREFS: DesignPrefs = {
  theme: "auto",
  font: { kind: "inter" },
  format: "vertical",
  hideProjectNames: false,
  musicFile: null,
};

// ---------------------------------------------------------------------------
// props.json — what the Remotion compositions receive
// ---------------------------------------------------------------------------

export type RecapProps = {
  stats: Stats;
  story: Story;
  /** prefs.theme is already resolved here ("auto" replaced by a real theme id). */
  prefs: DesignPrefs;
  /** Scenes to play, in order (already filtered). */
  scenes: SceneId[];
  /** Shown in every footer, because screenshots lose links. */
  repoUrl: string;
  /** For a custom font: path relative to video/public (render.ts copies the file there). */
  customFontStaticPath: string | null;
  /** Music file relative to video/public, or null. */
  musicStaticPath: string | null;
};

/** Expected public repo (the user's GitHub is notsocj, like marKit). Not created yet — change in ONE place if it moves. */
export const REPO_URL = "github.com/notsocj/rewynd";
