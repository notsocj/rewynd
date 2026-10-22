// =============================================================================
// shipped/collect-shipped.ts — git → per-day "What you shipped" numbers.
//
// 1. Which repos: the git repos behind your human AI sessions (worktrees are
//    merged into their main repo by sources/project-name.ts). We only look at
//    repos you actually worked on with AI.
// 2. For each repo: your commits on the default branch in the date range.
// 3. Classify each commit (shipped/ai-match.ts) and add it to its local day.
// The result is merged into data/days/ like everything else, so it survives
// even if a repo is later deleted or moved.
// =============================================================================

import path from "node:path";
import { local } from "../lib/time.ts";
import { info, warn, errMsg } from "../lib/log.ts";
import type { GitDay } from "../store/day.ts";
import { readCommits, myEmails } from "./git-log.ts";
import { classify, codexBranchCommits, type SessionWindow } from "./ai-match.ts";

export type RepoActivity = {
  /** Absolute path of the main repo root. */
  root: string;
  /** Display name (folder name). */
  name: string;
  windows: SessionWindow[];
};

export type ShippedInput = {
  repos: Map<string, RepoActivity>;
  /** Hashes printed inside Codex sessions (any repo). */
  codexHashes: Set<string>;
  /** Extra "this is me" emails from data/preferences.json. */
  extraEmails: string[];
};

const emptyGitDay = (): GitDay => ({
  commits: 0,
  linesAdded: 0,
  linesRemoved: 0,
  ai: { claude: 0, codex: { exact: 0, branch: 0, time: 0 }, copilot: 0, unknown: 0 },
  repos: {},
});

export async function collectShipped(input: ShippedInput, from: string, to: string): Promise<Map<string, GitDay>> {
  const days = new Map<string, GitDay>();
  const names = uniqueNames([...input.repos.values()]);
  for (const repo of input.repos.values()) {
    try {
      const me = myEmails(repo.root, input.extraEmails);
      const commits = readCommits(repo.root, from, to).filter(
        (c) => me.has(c.authorEmail) || c.authorEmail.endsWith("@anthropic.com"),
      );
      if (!commits.length) continue;
      const ctx = {
        codexHashes: input.codexHashes,
        codexBranchCommits: await codexBranchCommits(repo.root),
        windows: repo.windows,
      };
      const name = names.get(repo.root) ?? repo.name;
      for (const c of commits) {
        const date = local(c.at).date;
        if (date < from || date > to) continue;
        const d = days.get(date) ?? emptyGitDay();
        days.set(date, d);
        const v = classify(c, ctx);
        d.commits++;
        d.linesAdded += c.linesAdded;
        d.linesRemoved += c.linesRemoved;
        const r = (d.repos[name] ??= { commits: 0, ai: 0, linesAdded: 0, linesRemoved: 0 });
        r.commits++;
        r.linesAdded += c.linesAdded;
        r.linesRemoved += c.linesRemoved;
        if (v.ai) {
          r.ai++;
          if (v.agent === "codex") d.ai.codex[v.tier]++;
          else d.ai[v.agent]++;
        }
      }
    } catch (e) {
      warn(`git: skipped ${repo.name} (${errMsg(e)})`);
    }
  }
  info(`git: read ${input.repos.size} repos, found commits on ${days.size} days`);
  return days;
}

/** Two repos both called "web"? Show them as "web (acme)" and "web (orbit)". */
function uniqueNames(repos: RepoActivity[]): Map<string, string> {
  const byName = new Map<string, RepoActivity[]>();
  for (const r of repos) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  const out = new Map<string, string>();
  for (const [name, list] of byName) {
    for (const r of list) out.set(r.root, list.length > 1 ? `${name} (${path.basename(path.dirname(r.root))})` : name);
  }
  return out;
}
