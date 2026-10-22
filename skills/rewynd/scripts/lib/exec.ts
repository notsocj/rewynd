// =============================================================================
// lib/exec.ts — run a local program (git, gh) and capture its output.
//
// We pass arguments as an array (never a shell string), so folder names with
// spaces or quotes ("My Projects") can't break the command or inject anything.
// =============================================================================

import { spawnSync } from "node:child_process";

export type ExecResult = { ok: boolean; code: number | null; stdout: string; stderr: string };

export function run(cmd: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): ExecResult {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 120_000,
    maxBuffer: 512 * 1024 * 1024, // `git log --numstat` on a big repo can be large
    windowsHide: true,
  });
  return {
    ok: r.status === 0 && !r.error,
    code: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? (r.error ? String(r.error) : ""),
  };
}

/** Shorthand for `git -C <dir> ...`. */
export function git(dir: string, args: string[], timeoutMs?: number): ExecResult {
  return run("git", ["-C", dir, ...args], { timeoutMs });
}

/** Is a program available on PATH? */
export function hasCommand(cmd: string): boolean {
  const r = spawnSync(cmd, ["--version"], { encoding: "utf8", windowsHide: true });
  return !r.error;
}
