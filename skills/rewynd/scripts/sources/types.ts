// =============================================================================
// sources/types.ts — the normalized shapes every agent adapter produces.
//
// Each agent stores history differently (JSONL, patch logs, SQLite...). An
// adapter's only job is to translate its agent's format into these types.
// Everything after the adapters (daily totals, stats, story samples, git
// matching) works on these shapes and never needs to know which agent the data
// came from. Adding an agent = writing one adapter file.
// =============================================================================

import type { AgentId, ToolCategory } from "../../contract/recap.ts";

export type { AgentId, ToolCategory };

/**
 * Who started the session.
 * - "human": you typed into it. These are the only sessions in your totals.
 * - "automated": background work (auto-reviews, sub-agents, tools driving an
 *   agent through an API). Kept separately; they only feed a joke line.
 */
export type Origin = "human" | "automated";
export type AutomatedKind = "review" | "subagent" | "other";

export type Message = {
  role: "user" | "assistant";
  /** Epoch milliseconds. */
  at: number;
  /** Model that wrote an ASSISTANT reply, when the agent records it. */
  model?: string;
  /**
   * The text of USER messages only. Lives in memory during one run to count
   * phrases ("please", "still broken") and to pick a few redacted story
   * samples. It is never written to data/.
   */
  text?: string;
};

export type ToolCall = {
  at: number;
  /** The agent's own tool name, e.g. "Edit", "apply_patch", "run_shell_command". */
  name: string;
  /** Agent-neutral bucket shown in the video ("Edit files", "Run commands"...). */
  category: ToolCategory;
};

/** Tokens reported by the agent at a point in time (attributed to that day). */
export type Usage = { at: number; tokensIn: number; tokensOut: number; model?: string };

export type Session = {
  agent: AgentId;
  id: string;
  origin: Origin;
  automatedKind?: AutomatedKind;
  /** Working folder the session ran in, if the agent recorded it. */
  cwd: string | null;
  messages: Message[];
  toolCalls: ToolCall[];
  usage: Usage[];
  /** Model name → number of assistant replies. */
  models: Record<string, number>;
  /** Commit hashes this session printed (e.g. "[main 1a2b3c4] ..."), for exact git matching. */
  commitHashes: string[];
  /** The file it was read from (for warnings only, never stored). */
  sourceFile: string;
};

export type DateRange = { from: string; to: string };

export type DetectResult = {
  found: boolean;
  /** Where the data was found (for /rewynd status). */
  paths: string[];
  /** Plain-language note: why it isn't found / supported, or anything odd. */
  note?: string;
  /** Detect-only agents (support planned later) set this to false. */
  supported?: boolean;
};

export interface AgentAdapter {
  id: AgentId;
  detect(): Promise<DetectResult>;
  /**
   * Stream every session that has activity on or after `range.from`
   * (pass the earliest date you care about). One session at a time, so memory
   * stays flat no matter how big the history is.
   */
  collect(range: DateRange): AsyncIterable<Session>;
}

/** Helper for adapters: a fresh, empty session. */
export function newSession(agent: AgentId, id: string, sourceFile: string): Session {
  return {
    agent,
    id,
    origin: "human",
    cwd: null,
    messages: [],
    toolCalls: [],
    usage: [],
    models: {},
    commitHashes: [],
    sourceFile,
  };
}

/** Earliest and latest timestamp of anything in a session (or null if empty). */
export function sessionBounds(s: Session): { start: number; end: number } | null {
  let start = Infinity;
  let end = -Infinity;
  for (const list of [s.messages, s.toolCalls, s.usage] as { at: number }[][]) {
    for (const e of list) {
      if (e.at < start) start = e.at;
      if (e.at > end) end = e.at;
    }
  }
  return Number.isFinite(start) ? { start, end } : null;
}
