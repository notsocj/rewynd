// =============================================================================
// shipped/ai-match.ts — decide whether a commit was made with AI, and by whom.
//
// Checked against real commits (rewynd-context.md §20):
//   Claude  → leaves "Co-Authored-By: Claude ... <noreply@anthropic.com>"
//             (or a Claude-Session trailer, or is authored by @anthropic.com). Certain.
//   Copilot → "Co-authored-by: Copilot <copilot@github.com>". Certain.
//   Codex   → leaves NO marker, so we use three tiers, best first:
//     1. exact  — the commit hash was printed inside a Codex session ("[main 1a2b3c4] ...")
//     2. branch — the commit was made on a codex/* branch (Codex's branch prefix)
//     3. time   — it landed during one of your Codex sessions, in the same repo
//   If a commit has no marker and falls inside sessions of 2+ agents → "unknown" AI.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { git } from "../lib/exec.ts";
import { readLineBuffers } from "../lib/lines.ts";
import type { AgentId } from "../../contract/recap.ts";
import type { Commit } from "./git-log.ts";

export type AiVerdict =
  | { ai: false }
  | { ai: true; agent: "claude" | "copilot" | "unknown" }
  | { ai: true; agent: "codex"; tier: "exact" | "branch" | "time" };

/** A human session's time window in one repo (built from the adapters' output). */
export type SessionWindow = { agent: AgentId; start: number; end: number };

/** After the last event, a commit can still belong to the session for this long. */
const WINDOW_SLACK_MS = 15 * 60_000;

export type RepoMatchContext = {
  /** Short or full hashes printed inside Codex sessions. */
  codexHashes: Set<string>;
  /** Full hashes made on / reachable from codex/* branches in this repo. */
  codexBranchCommits: Set<string>;
  /** Human session windows in this repo, any agent. */
  windows: SessionWindow[];
};

export function classify(c: Commit, ctx: RepoMatchContext): AiVerdict {
  const t = c.trailers;
  if (
    c.authorEmail.endsWith("@anthropic.com") ||
    t.some((x) => x.startsWith("claude-session:")) ||
    t.some((x) => x.startsWith("co-authored-by:") && (x.includes("anthropic.com") || /\bclaude\b/.test(x)))
  ) {
    return { ai: true, agent: "claude" };
  }
  if (t.some((x) => x.startsWith("co-authored-by:") && x.includes("copilot"))) return { ai: true, agent: "copilot" };
  if (t.some((x) => x.startsWith("co-authored-by:") && /\b(codex|openai)\b/.test(x))) return { ai: true, agent: "codex", tier: "exact" };

  for (const len of [7, 8, 9, 10, 11, 12, 40]) {
    if (ctx.codexHashes.has(c.hash.slice(0, len))) return { ai: true, agent: "codex", tier: "exact" };
  }
  if (ctx.codexBranchCommits.has(c.hash)) return { ai: true, agent: "codex", tier: "branch" };

  const agents = new Set<AgentId>();
  for (const w of ctx.windows) if (c.at >= w.start && c.at <= w.end + WINDOW_SLACK_MS) agents.add(w.agent);
  if (agents.size === 1) {
    const only = [...agents][0];
    if (only === "codex") return { ai: true, agent: "codex", tier: "time" };
    if (only === "claude-code") return { ai: true, agent: "claude" }; // attribution turned off
    return { ai: true, agent: "unknown" };
  }
  if (agents.size > 1) return { ai: true, agent: "unknown" };
  return { ai: false };
}

/**
 * Commits Codex created on its own codex/* branches, read from the branch
 * reflogs (.git/logs/refs/heads/codex/...). A reflog line records every
 * commit made on that branch, e.g. "<old> <new> name <email> <time>\tcommit: ...".
 * Once the branch is fast-forward or rebase-merged, those same hashes are on
 * main, and that's how we recognise merged Codex work.
 *
 * Why not "everything reachable from codex/* branches"? A branch also reaches
 * all of main's older history, which would wrongly credit Codex for it.
 * (Squash merges create a new hash; those fall back to the time tier.)
 * Git keeps reflogs ~90 days, one more reason rewynd saves days as it goes.
 */
export async function codexBranchCommits(repo: string): Promise<Set<string>> {
  const out = new Set<string>();
  const commonDir = git(repo, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).stdout.trim();
  const logDir = path.join(commonDir, "logs", "refs", "heads", "codex");
  if (!commonDir || !fs.existsSync(logDir)) return out;
  for (const file of walk(logDir)) {
    for await (const line of readLineBuffers(file)) {
      const s = line.toString("utf8");
      const tab = s.indexOf("\t");
      const msg = tab === -1 ? "" : s.slice(tab + 1);
      // Entries that CREATE commits on the branch. Skip "branch: Created from ..."
      // (that's the starting point on main, not Codex's work) and resets.
      if (!/^(commit|rebase|cherry-pick|merge)/.test(msg)) continue;
      const newHash = s.split(" ")[1];
      if (newHash && /^[0-9a-f]{40}$/.test(newHash)) out.add(newHash);
    }
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
