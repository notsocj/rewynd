// =============================================================================
// store/git-guard.ts — make sure nobody's personal stats end up on GitHub.
//
// data/ is in .gitignore. But an ignore rule can be deleted, or someone can
// `git add -f` the folder. On every run we check whether git is TRACKING
// anything inside data/ (or output/), and if so print a loud warning with the
// fix. We only warn: we never change the user's git state ourselves.
// Also used by the test suite, so a contributor can't commit sample data.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { git } from "../lib/exec.ts";
import { dataDir, outputDir, isDir } from "../lib/paths.ts";

export type GuardResult = { ok: true } | { ok: false; tracked: string[]; repo: string; fix: string };

export function checkNotTracked(): GuardResult {
  for (const dir of [dataDir(), outputDir()]) {
    const parent = path.dirname(dir);
    if (!isDir(parent)) continue;
    const top = git(parent, ["rev-parse", "--show-toplevel"], 10_000);
    if (!top.ok) continue; // not inside a git repo: nothing can be pushed
    const repo = path.resolve(top.stdout.trim());
    // git reports the REAL path (e.g. /private/var/... on macOS, or the long
    // C:\Users\runneradmin\... form on Windows) while ours may go through a
    // symlink (/var/...) or a short 8.3 name (C:\Users\RUNNER~1\...), so
    // compare real paths. realpathSync.native expands both.
    const realDir = path.join(fs.realpathSync.native(parent), path.basename(dir));
    const rel = path.relative(repo, realDir) || ".";
    const ls = git(repo, ["ls-files", "--", rel], 10_000);
    const tracked = ls.stdout.split("\n").filter(Boolean);
    if (tracked.length) {
      return {
        ok: false,
        tracked: tracked.slice(0, 10),
        repo,
        fix: `git -C "${repo}" rm -r --cached "${rel}"  # stops tracking it; your files stay on disk`,
      };
    }
  }
  return { ok: true };
}
