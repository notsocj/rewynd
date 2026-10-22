// =============================================================================
// store/day.ts — what one saved day looks like (data/days/YYYY-MM-DD.json).
//
// A day file is rewynd's memory. Once written, the agent can delete its
// transcripts and the day still counts in every future recap.
//
// AGGREGATES ONLY: counts, minutes, model names, tool buckets, project folder
// NAMES, agent names, phrase counts. Never message text, code, file contents,
// commit messages, emails or full paths.
// =============================================================================

import type { AgentId, BackgroundCounts, ToolCategory } from "../../contract/recap.ts";
import type { Phrases } from "../sources/phrases.ts";

export const DAY_SCHEMA_VERSION = 1;

/**
 * Version of the COUNTING RULES (idle gaps, what counts as your message...).
 * Bump it when a fix changes how days are computed. Saved days made by older
 * rules are then recomputed, but only where every agent's logs for that day
 * are still on disk. Days whose logs are gone keep their saved numbers.
 *   2: text the desktop apps wrap around your messages (attached skills, page
 *      context, file lists) no longer counts as you (sources/user-text.ts).
 */
export const ALGO_VERSION = 2;

/** One agent's numbers for one day. Human sessions only, except `automated`. */
export type AgentDay = {
  /** Human sessions that STARTED this day. */
  sessions: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  /** Minutes with activity (overlapping sessions of this agent counted once). */
  activeMinutes: number;
  /** Model name → assistant replies. */
  models: Record<string, number>;
  tools: Partial<Record<ToolCategory, number>>;
  /** Human sessions started between 00:00 and 04:59. */
  lateNightSessions: number;
  /** Longest human session that started this day. */
  longestSession: { project: string; minutes: number } | null;
  phrases: Phrases;
  /** Background runs that started this day. Never part of the numbers above. */
  automated: BackgroundCounts;
};

export type ProjectDay = {
  name: string;
  agents: AgentId[];
  sessions: number;
  minutes: number;
  /** Local "HH:MM" of the first / last activity in this project that day. */
  firstAt: string;
  lastAt: string;
  /** Agent of the first / last human session that day (to chain switches across days). */
  firstAgent: AgentId;
  lastAgent: AgentId;
  /** Times the project moved to a different agent within the day. */
  switches: number;
};

/** "What you shipped" numbers for one day (§20). Counts only. */
export type GitDay = {
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  ai: {
    claude: number;
    codex: { exact: number; branch: number; time: number };
    copilot: number;
    unknown: number;
  };
  repos: Record<string, { commits: number; ai: number; linesAdded: number; linesRemoved: number }>;
};

export type GithubDay = { prsMerged: number; releases: number; starsGained: number };

export type DayRecord = {
  schemaVersion: number;
  /** Counting-rules version that produced this day (see ALGO_VERSION). */
  algo?: number;
  date: string;
  timezone: string;
  savedAt: string;
  agents: Partial<Record<AgentId, AgentDay>>;
  /** Minutes with ANY agent active (parallel sessions counted once). */
  activeMinutes: number;
  /** Active minutes per local hour (24 values). */
  hours: number[];
  projects: ProjectDay[];
  /** Consecutive human sessions with different agents: "claude-code>codex" → count. */
  switches: { pairs: Record<string, number> };
  git?: GitDay;
  github?: GithubDay;
};

export const emptyBackground = (): BackgroundCounts => ({ review: 0, subagent: 0, other: 0 });

export function emptyDay(date: string, timezone: string): DayRecord {
  return {
    schemaVersion: DAY_SCHEMA_VERSION,
    algo: ALGO_VERSION,
    date,
    timezone,
    savedAt: new Date().toISOString(),
    agents: {},
    activeMinutes: 0,
    hours: new Array(24).fill(0),
    projects: [],
    switches: { pairs: {} },
  };
}

/** How much data an agent-day holds. Used by the never-shrink rule (store/merge.ts). */
export function agentDayWeight(a: AgentDay | undefined): [number, number, number] {
  if (!a) return [-1, -1, -1];
  const bg = a.automated.review + a.automated.subagent + a.automated.other;
  return [a.userMessages, a.activeMinutes, a.sessions * 1000 + bg];
}
