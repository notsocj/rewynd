// =============================================================================
// sources/project-name.ts — turn a session's working folder into a project.
//
// Agents record the folder a session ran in (cwd). We want one stable name per
// project, and the git repo it belongs to (for the "What you shipped" scene):
//   ~/code/lumen                         → lumen
//   ~/code/lumen/apps/web                → lumen (the git repo root)
//   ~/code/lumen/.claude/worktrees/abc   → lumen (a worktree of the same repo)
//   ~/.codex/worktrees/b340/harbor-api   → harbor-api
//   ~                                    → "home folder"
// Results are cached, because many sessions share a folder and asking git is
// a process spawn.
// =============================================================================

import path from "node:path";
import { git } from "../lib/exec.ts";
import { home, isDir } from "../lib/paths.ts";

export type ProjectInfo = {
  /** Display name (folder name of the repo root, or of the cwd). */
  name: string;
  /** Absolute path of the main repo's root, or null if not in a git repo (or folder is gone). */
  repoRoot: string | null;
};

const cache = new Map<string, ProjectInfo>();

export function projectOf(cwd: string | null): ProjectInfo | null {
  if (!cwd) return null;
  const hit = cache.get(cwd);
  if (hit) return hit;
  const info = resolve(cwd);
  cache.set(cwd, info);
  return info;
}

function resolve(cwd: string): ProjectInfo {
  if (path.resolve(cwd) === home()) return { name: "home folder", repoRoot: null };

  if (isDir(cwd)) {
    // --git-common-dir points at the MAIN repo's .git even from inside a
    // worktree, so all worktrees of one repo collapse into one project.
    const r = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"], 10_000);
    if (r.ok) {
      const common = r.stdout.trim();
      const root = path.basename(common) === ".git" ? path.dirname(common) : null;
      if (root) return { name: path.basename(root), repoRoot: root };
      // A bare repo or unusual layout: fall back to the toplevel.
      const top = git(cwd, ["rev-parse", "--show-toplevel"], 10_000);
      if (top.ok) return { name: path.basename(top.stdout.trim()), repoRoot: top.stdout.trim() };
    }
  }

  // Folder deleted/moved, or not a git repo: still give it a sensible name.
  return { name: nameFromPath(cwd), repoRoot: null };
}

/** Best-effort name from the path alone (handles worktree folder patterns). */
export function nameFromPath(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  // <repo>/.claude/worktrees/<name>  → <repo>
  const wt = parts.lastIndexOf("worktrees");
  if (wt >= 2 && parts[wt - 1] === ".claude") return parts[wt - 2];
  // ~/.codex/worktrees/<id>/<repo>  → <repo>
  if (wt >= 1 && parts[wt - 1] === ".codex" && parts.length > wt + 2) return parts[wt + 2];
  return parts[parts.length - 1] ?? cwd;
}
