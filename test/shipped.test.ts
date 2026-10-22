// "What you shipped": default-branch-only commits, your commits only, the
// noise filter, AI markers, the codex/* reflog tier, and the git guard.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readCommits, isNoise } from "../scripts/shipped/git-log.ts";
import { classify, codexBranchCommits } from "../scripts/shipped/ai-match.ts";
import { checkNotTracked } from "../scripts/store/git-guard.ts";
import { setStateRoot } from "../scripts/lib/paths.ts";
import { tempDir } from "./helpers.ts";

function repo(): { dir: string; git: (...a: string[]) => string } {
  const dir = tempDir("rewynd-git-");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { env, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "me@example.com");
  git("config", "user.name", "Me");
  git("config", "commit.gpgsign", "false");
  return { dir, git };
}

function commit(r: ReturnType<typeof repo>, file: string, lines: number, msg: string, date = "2026-10-21T10:00:00Z") {
  fs.mkdirSync(path.dirname(path.join(r.dir, file)), { recursive: true });
  fs.writeFileSync(path.join(r.dir, file), Array.from({ length: lines }, (_, i) => `line ${i} ${Math.random()}`).join("\n"));
  r.git("add", "-A");
  execFileSync("git", ["-C", r.dir, "commit", "-q", "-m", msg], {
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_CONFIG_GLOBAL: "/dev/null" },
  });
}

test("default branch only, AI trailers, noise filter, codex/* reflog tier", async () => {
  const r = repo();
  commit(r, "a.ts", 10, "feat: a\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>");
  commit(r, "package-lock.json", 5000, "chore: lock"); // noise: 0 lines counted
  commit(r, "c.ts", 3, "fix: c\n\nCo-authored-by: Copilot <copilot@github.com>");
  // Codex works on its own branch, then it's fast-forwarded into main.
  r.git("checkout", "-q", "-b", "codex/fix-login");
  commit(r, "d.ts", 4, "fix: login");
  r.git("checkout", "-q", "main");
  r.git("merge", "-q", "--ff-only", "codex/fix-login");
  // Unmerged branch work is NOT shipped.
  r.git("checkout", "-q", "-b", "wip");
  commit(r, "e.ts", 7, "wip");
  r.git("checkout", "-q", "main");

  const commits = readCommits(r.dir, "2026-10-01", "2026-10-31");
  assert.equal(commits.length, 4, "the wip commit isn't on main");
  const lock = commits.find((c) => c.linesAdded === 0);
  assert.ok(lock, "lockfile lines are filtered out");

  const branchCommits = await codexBranchCommits(r.dir);
  const ctx = { codexHashes: new Set<string>(), codexBranchCommits: branchCommits, windows: [] };
  const verdicts = commits.map((c) => classify(c, ctx));
  const agents = verdicts.map((v) => (v.ai ? (v.agent === "codex" ? `codex:${v.tier}` : v.agent) : "none")).sort();
  assert.deepEqual(agents, ["claude", "codex:branch", "copilot", "none"]);
});

test("codex exact + time tiers", () => {
  const base = { authorEmail: "me@example.com", trailers: [], linesAdded: 1, linesRemoved: 0 };
  const at = Date.parse("2026-10-21T10:00:00Z");
  const exact = classify({ ...base, hash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b", at }, { codexHashes: new Set(["1a2b3c4"]), codexBranchCommits: new Set(), windows: [] });
  assert.deepEqual(exact, { ai: true, agent: "codex", tier: "exact" });
  const timed = classify({ ...base, hash: "f".repeat(40), at }, { codexHashes: new Set(), codexBranchCommits: new Set(), windows: [{ agent: "codex", start: at - 600000, end: at - 60000 }] });
  assert.deepEqual(timed, { ai: true, agent: "codex", tier: "time" });
  const both = classify({ ...base, hash: "e".repeat(40), at }, { codexHashes: new Set(), codexBranchCommits: new Set(), windows: [{ agent: "codex", start: at - 1, end: at }, { agent: "gemini", start: at - 1, end: at }] });
  assert.deepEqual(both, { ai: true, agent: "unknown" });
});

test("noise filter", () => {
  for (const f of ["package-lock.json", "web/yarn.lock", "node_modules/x/y.js", "dist/app.js", "a.min.js", "ios/Pods/x.m", "src/__snapshots__/a.snap"]) assert.ok(isNoise(f), f);
  for (const f of ["src/app.ts", "README.md", "lib/lock-screen.ts"]) assert.ok(!isNoise(f), f);
});

test("git guard warns when data/ is tracked", () => {
  const r = repo();
  fs.mkdirSync(path.join(r.dir, "data", "days"), { recursive: true });
  fs.writeFileSync(path.join(r.dir, "data", "days", "2026-10-21.json"), "{}");
  setStateRoot(r.dir);
  assert.equal(checkNotTracked().ok, true, "untracked data is fine");
  r.git("add", "-f", "data");
  const res = checkNotTracked();
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.fix, /rm -r --cached/);
  setStateRoot(null);
});
