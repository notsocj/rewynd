// =============================================================================
// shipped/git-log.ts — read YOUR commits that reached a repo's default branch.
//
// What we ask git for (and nothing else): commit hash, author email, author
// date, trailers ("Co-Authored-By: ..."), and per-file line counts. We never
// read commit messages or code. Emails are only compared against "is this
// you?" and are never saved.
// =============================================================================

import { git } from "../lib/exec.ts";
import { addDays } from "../lib/time.ts";

export type Commit = {
  hash: string;
  /** Author time, epoch ms (when the work was done, not when it was rebased). */
  at: number;
  authorEmail: string;
  /** Lower-cased "key: value" trailer lines, e.g. "co-authored-by: claude opus 5.5 <noreply@anthropic.com>". */
  trailers: string[];
  linesAdded: number;
  linesRemoved: number;
};

// Files whose line counts say nothing about work done: lockfiles, build output,
// vendored deps, minified bundles, snapshots. Without this filter a busy month
// can show hundreds of thousands of "lines added", mostly generated.
const NOISE = [
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|Gemfile\.lock|poetry\.lock|composer\.lock|Podfile\.lock|go\.sum|Package\.resolved|pubspec\.lock|uv\.lock|flake\.lock)$/,
  /\.lock$/,
  /(^|\/)(node_modules|vendor|dist|build|out|\.next|\.nuxt|\.svelte-kit|\.expo|coverage|Pods|DerivedData|\.turbo|\.vercel|\.output|target|__snapshots__)\//,
  /\.min\.(js|css|mjs)$/,
  /\.(map|snap|lcov)$/,
  /(^|\/)\.?generated?[/.]/i,
];
/** One file can add at most this many lines per commit (a vendored dump shouldn't dominate). */
const MAX_LINES_PER_FILE = 5000;

export const isNoise = (file: string) => NOISE.some((r) => r.test(file));

/** The default branch refs to read: local main/master + its remote twin. */
export function defaultBranchRefs(repo: string): string[] {
  const refs: string[] = [];
  const originHead = git(repo, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  let name: string | null = null;
  if (originHead.ok) {
    const full = originHead.stdout.trim(); // e.g. "origin/main"
    refs.push(full);
    name = full.replace(/^origin\//, "");
  }
  const candidates = name ? [name] : ["main", "master", "trunk", "develop"];
  for (const c of candidates) {
    if (git(repo, ["rev-parse", "--verify", "--quiet", `refs/heads/${c}`]).ok) {
      refs.push(c);
      break;
    }
  }
  if (!refs.length) refs.push("HEAD"); // detached or unusual repo: use whatever is checked out
  return refs;
}

/**
 * Commits on the default branch whose author date falls in [from, to] (local
 * calendar dates; we fetch with 2 days of slack and the caller buckets by
 * local day). Merge commits are skipped: they repeat work already counted.
 */
export function readCommits(repo: string, from: string, to: string): Commit[] {
  const refs = defaultBranchRefs(repo);
  const r = git(
    repo,
    [
      "log",
      ...refs,
      "--no-merges",
      `--since=${addDays(from, -2)}T00:00:00`,
      `--until=${addDays(to, 2)}T00:00:00`,
      "--date=iso-strict",
      "--numstat",
      "--format=%x1e%H%x1f%ae%x1f%aI%x1f%(trailers:unfold,separator=%x1d)",
    ],
    180_000,
  );
  if (!r.ok) return [];
  const out: Commit[] = [];
  for (const block of r.stdout.split("\x1e")) {
    if (!block.trim()) continue;
    const nl = block.indexOf("\n");
    const headerLine = nl === -1 ? block : block.slice(0, nl);
    const [hash, email, date, trailerBlob = ""] = headerLine.split("\x1f");
    const at = Date.parse(date);
    if (!hash || !Number.isFinite(at)) continue;
    let added = 0;
    let removed = 0;
    for (const line of (nl === -1 ? "" : block.slice(nl + 1)).split("\n")) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m || m[1] === "-") continue; // "-" = binary file
      const file = m[3].replace(/^.*=> /, "").replace(/[{}]/g, ""); // renames: "a/{x => y}.ts"
      if (isNoise(file)) continue;
      added += Math.min(Number(m[1]), MAX_LINES_PER_FILE);
      removed += Math.min(Number(m[2]), MAX_LINES_PER_FILE);
    }
    out.push({
      hash,
      at,
      authorEmail: email.toLowerCase(),
      trailers: trailerBlob.split("\x1d").map((t) => t.trim().toLowerCase()).filter(Boolean),
      linesAdded: added,
      linesRemoved: removed,
    });
  }
  return out;
}

/** The user's git email addresses: global config + this repo's config (+ extras from prefs). */
export function myEmails(repo: string, extra: string[] = []): Set<string> {
  const set = new Set(extra.map((e) => e.toLowerCase()));
  for (const args of [["config", "--global", "user.email"], ["config", "user.email"]]) {
    const r = git(repo, args);
    if (r.ok && r.stdout.trim()) set.add(r.stdout.trim().toLowerCase());
  }
  return set;
}
