// =============================================================================
// shipped/github.ts — OPTIONAL GitHub numbers. THE ONLY NETWORK CODE IN REWYND.
//
// Runs only when the user passes --github, and only if the GitHub CLI (`gh`)
// is installed and logged in. rewynd never asks for, reads, or stores a token:
// every request goes through the user's own `gh` login, read-only.
//
// For the chosen period it counts, per day:
//   - pull requests you authored that were merged
//   - releases published in repos you own
//   - new stars on repos you own
// Only counts are kept: no PR titles, bodies, or stargazer names.
// =============================================================================

import { run, hasCommand } from "../lib/exec.ts";
import { local, toMs } from "../lib/time.ts";
import { info, warn } from "../lib/log.ts";
import type { GithubDay } from "../store/day.ts";

const MAX_PAGES = 40;

export type GithubResult = { ok: true; days: Map<string, GithubDay> } | { ok: false; reason: string };

function gh(args: string[]): string | null {
  const r = run("gh", args, { timeoutMs: 90_000 });
  return r.ok ? r.stdout : null;
}

export function githubAvailable(): { ok: true } | { ok: false; reason: string } {
  if (!hasCommand("gh")) return { ok: false, reason: "the GitHub CLI (gh) isn't installed" };
  const status = run("gh", ["auth", "status"], { timeoutMs: 30_000 });
  if (!status.ok) return { ok: false, reason: "gh isn't logged in. Run `gh auth login` first" };
  return { ok: true };
}

export function collectGithub(from: string, to: string): GithubResult {
  const avail = githubAvailable();
  if (!avail.ok) return avail;

  const days = new Map<string, GithubDay>();
  const bump = (iso: string | null | undefined, key: keyof GithubDay) => {
    const ms = toMs(iso);
    if (ms === null) return;
    const date = local(ms).date;
    if (date < from || date > to) return;
    const d = days.get(date) ?? { prsMerged: 0, releases: 0, starsGained: 0 };
    d[key]++;
    days.set(date, d);
  };

  const login = gh(["api", "user", "--jq", ".login"])?.trim();
  if (!login) return { ok: false, reason: "couldn't read your GitHub username from gh" };
  info(`GitHub: reading merged PRs, releases and stars for ${login} (read-only)`);

  // 1) Merged PRs you authored (search API, merged date in range).
  const prs = gh([
    "api", "-X", "GET", "search/issues",
    "-f", `q=is:pr is:merged author:${login} merged:${from}..${to}`,
    "-f", "per_page=100", "--paginate",
    "--jq", ".items[].pull_request.merged_at",
  ]);
  if (prs === null) warn("GitHub: couldn't search merged PRs; skipping that number");
  for (const line of (prs ?? "").split("\n")) if (line.trim()) bump(line.trim(), "prsMerged");

  // 2) Your own (non-fork) repos.
  const repoLines = gh([
    "api", "user/repos?affiliation=owner&per_page=100", "--paginate",
    "--jq", '.[] | select(.fork | not) | [.full_name, .stargazers_count, .pushed_at] | @tsv',
  ]);
  if (repoLines === null) {
    warn("GitHub: couldn't list your repos; skipping releases and stars");
    return { ok: true, days };
  }
  const repos = repoLines
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, stars, pushed] = l.split("\t");
      return { name, stars: Number(stars) || 0, pushed: pushed ?? "" };
    });

  for (const repo of repos) {
    // Releases: only repos pushed to since the period started can have new ones.
    if (repo.pushed && repo.pushed.slice(0, 10) >= from) {
      const rel = gh(["api", `repos/${repo.name}/releases?per_page=100`, "--jq", ".[] | select(.draft | not) | .published_at"]);
      for (const line of (rel ?? "").split("\n")) if (line.trim() && line.trim() !== "null") bump(line.trim(), "releases");
    }
    // Stars: needs the special "star+json" media type to get the starred_at date.
    if (repo.stars > 0) {
      const stars = gh([
        "api", `repos/${repo.name}/stargazers?per_page=100`, "--paginate",
        "-H", "Accept: application/vnd.github.star+json",
        "--jq", ".[].starred_at",
      ]);
      const lines = (stars ?? "").split("\n").filter(Boolean);
      for (const line of lines.slice(-MAX_PAGES * 100)) bump(line.trim(), "starsGained");
    }
  }
  return { ok: true, days };
}
