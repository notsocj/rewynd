# rewynd — Project Context

> Your year of AI coding, as a video.
> A free, open-source Claude Code / Codex skill that reads your local Claude Code and Codex history and turns it into a recap **video** with its own "tape rewind meets terminal" look (rendered with Remotion), plus a quick image card. Monthly recaps, plus a yearly one in December.

This file is the full context for continuing development in Claude Code. Read it before writing any code.

---

## 1. The idea in one paragraph

Developers spend hundreds of hours a year coding with Claude Code and Codex. Both tools keep session logs on the user's machine. rewynd reads those logs locally, counts the stats with a plain script (zero tokens), has Claude write a short, funny "story of your year" from a small redacted sample, and renders it as a vertical video with a pre-built Remotion template. The output is made to be posted on X, TikTok, and Reels in December.

---

## 2. Competition (checked Oct 22, 2026)

The "Claude Code Wrapped" space is already crowded. All of these exist:

| Project | What it does | Output |
|---|---|---|
| `cc-wrapped` (npm) | Sessions, messages, tokens, projects, streaks, heatmap, top models, cost | PNG card |
| `claude-code-wrapped` (PyPI/npm) | Stats revealed one at a time, "cinematic" terminal experience | Terminal |
| `claude-year-in-review` (npm) | Wrapped-style usage, local, zero dependencies | Terminal/card |
| `agent-wrapped` (agent-wrapped.dev) | Wrapped card + monthly ~1 KB snapshots | Terminal + HTML card |
| `code-wrapped` (htin1) | Yearly review via the Anthropic Admin API | Image/SVG |
| `vibestats` | Claude Code + Codex stats, `--wrapped` recap, heatmaps, share pages | Web page |
| `agentboard.cc` | Stats cards + a public leaderboard (uploads aggregate stats) | Web |
| `cw:wrapped` skill | Wrapped for Cursor usage | Text |
| Claude Code `/insights` | Built-in usage insights | Text |

**Takeaway:** a stats card alone will NOT stand out. Every existing tool only *counts* things.

---

## 3. How rewynd wins (the differentiators)

1. **Real video, not a card.** Vertical 9:16 MP4 rendered with Remotion. None of the competitors found render a video.
2. **A story, not just numbers.** Claude reads a small redacted sample of the user's own messages and writes the narrative: what they built, their hardest bug, funny moments, a "coder personality." Counting tools can't do this — only an AI skill can.
3. **Claude Code + Codex together** in one recap.
4. **It keeps your year even after your agent deletes it** (see §4 and §19). rewynd saves daily totals in its own folder and never touches agent settings. This is also the launch hook.
5. **100% local by default.** No uploads, no account, no network calls. The single exception is the opt-in `/rewynd --github` (§20).
6. **What you shipped, not just what you chatted.** Local git history shows how many of your commits were made with AI (§20).

---

## 4. Critical constraint: Claude Code deletes history after 30 days

- Claude Code setting `cleanupPeriodDays` defaults to **30**. On startup, session transcripts older than that are **permanently deleted**.
- Minimum is 1; `0` is rejected with a validation error.
- Users work around it by setting `"cleanupPeriodDays": 3650` (or higher) in `~/.claude/settings.json`.
- Anthropic's stated reason: transcripts are unencrypted and can contain code, credentials, and secrets, so 30 days is a security default.

**What this means for rewynd** (updated Oct 22, 2026, see §19):
- If someone runs a "year in review" in December with default settings, Claude Code only has ~1 month of transcripts.
- **rewynd does NOT change `cleanupPeriodDays` or any other agent setting. Ever.** The 30-day default is a deliberate security choice by Anthropic, and we respect it.
- Instead, rewynd keeps its **own daily totals** (aggregates only, never message text) in `data/days/YYYY-MM-DD.json` inside the rewynd folder. Every `/rewynd` run saves any days that aren't saved yet. Once a day is saved, it stays complete even after the transcripts are deleted.
- So the one thing users have to do is **run `/rewynd` at least once every 30 days**. `/rewynd-setup` is now optional: it only explains this and runs the first save.
- `~/.claude/history.jsonl` (prompt history) may survive longer than transcripts on some machines. **Test this on a real machine** before relying on it. On one test machine it was only a few KB.

**Launch message idea:** "Claude Code deletes your history every 30 days. Run rewynd once now (and once a month) and it keeps your daily totals, so your December recap covers the whole year. It never changes your settings and never stores your messages."

---

## 5. Data sources (verify formats on a real machine — they change between versions)

> All agents (Gemini CLI, OpenCode, Cursor…) and the verified findings are in **§18 Multi-agent support**.

### Claude Code
- Transcripts: `~/.claude/projects/<project-path>/<session-id>.jsonl` — one JSON object per line, plain text, unencrypted.
- Subagent runs may have their own files under a `subagents/` folder.
- Prompt history: `~/.claude/history.jsonl`
- Settings: `~/.claude/settings.json` (where `cleanupPeriodDays` lives). rewynd may *read* it to show the user their current retention; it never writes it.
- `cc-wrapped` also reads `~/.claude/stats-cache.json` — check whether it exists and what's in it.
- On Windows `~/.claude` = `%USERPROFILE%\.claude`.

### Codex CLI
- Transcripts: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
- Newer versions may write Zstandard-compressed `rollout-*.jsonl.zst` — support both.
- Lines have a `type` field (e.g. `session_meta` with id, cwd, model, git info).
- History: `~/.codex/history.jsonl`
- ⚠️ **Codex files can be enormous** (users report single files of hundreds of MB to ~2 GB, and session folders of 90 GB+). The collector MUST stream line by line and never load a whole file into memory, and never pass raw files to Claude.

---

## 6. Architecture (3 stages)

```
┌───────────────┐     ┌────────────────┐     ┌────────────────┐
│ 1. COLLECT    │ ──▶ │ 2. STORY       │ ──▶ │ 3. RENDER      │
│ Node script   │     │ Claude (skill) │     │ Remotion       │
│ 0 tokens      │     │ small input    │     │ 0 tokens       │
│ → stats.json  │     │ → story.json   │     │ → rewynd.mp4   │
│ → samples.json│     │                │     │ → card.png     │
└───────────────┘     └────────────────┘     └────────────────┘
```

### Stage 1 — Collect (script, no tokens)
- Streams every detected agent's logs (§18), saves any new days to `data/days/` (§19), then builds `stats.json` from the **saved days**, not straight from the logs.
- Also picks a small sample of user messages into `samples.json` (see Stage 2 limits).
- Runs secret redaction on samples before writing them (API keys, tokens, emails, `.env`-style lines, long random strings).

### Stage 2 — Story (Claude)
- Claude reads ONLY `stats.json` + `samples.json`. Never raw logs, never full diffs.
- Token budget target: keep the input small (aim for well under ~20k tokens).
- Ask the user before Claude reads the samples ("rewynd will read ~200 of your messages, redacted, to write your story. OK?").
- Outputs `story.json`: captions per scene, personality title, funny lines, top projects summary.

### Stage 3 — Render (Remotion, no tokens)
- The skill ships a **pre-built Remotion template**. `stats.json` + `story.json` are passed in as props.
- Claude must NOT write new Remotion code each run (wastes tokens, inconsistent quality).
- Validate props with a Zod schema.
- The look is chosen by the user before rendering (style, accent, font, format), and saved to `data/preferences.json`. See DESIGN.md §8.
- Formats: 1080×1920 (9:16, default) and 1920×1080 (16:9 for X). ~30–45 seconds.
- Card mode (`/rewynd-card`) renders a single still (Remotion `renderStill`) so people without time for a video still get a screenshot.

---

## 7. Commands

| Command | What it does |
|---|---|
| `/rewynd-setup` | **Optional.** Explains the 30-day deletion in plain words, tells the user to run `/rewynd` at least once every 30 days, and runs the first daily save. **Changes no settings.** |
| `/rewynd` | Save new days → build stats from saved days → story → ask design choices (or reuse saved ones) → render the video |
| `/rewynd-card` | Same, but outputs one image |
| `/rewynd-status` | Shows what's saved: number of days, first/last saved day, gaps, per-agent date ranges still on disk, and "days until your oldest unsaved transcript is deleted". Also saves new days |

### Saving days
- There's no background job and no hook. Hooks live in the agent's `settings.json`, and we don't touch that. Days are saved whenever the user runs any rewynd command.
- Days go in `data/days/YYYY-MM-DD.json` inside the rewynd folder. Full rules in §19.

---

## 8. Stats to compute (stats.json)

Draft schema — refine after looking at real log formats:

```jsonc
{
  "year": 2026,
  "range": { "from": "2026-01-03", "to": "2026-12-01" },
  "sources": { "claudeCode": true, "codex": true },
  "totals": {
    "sessions": 0,
    "userMessages": 0,
    "assistantMessages": 0,
    "toolCalls": 0,
    "tokensIn": 0,
    "tokensOut": 0,
    "activeHours": 0
  },
  "byTool": { "claudeCode": {}, "codex": {} },
  "projects": [ { "name": "lumen", "sessions": 0, "messages": 0 } ],
  "topTools": [ { "name": "Edit", "count": 0 } ],        // Bash, Read, Edit...
  "models": [ { "name": "...", "share": 0 } ],
  "time": {
    "busiestDay": "2026-..",
    "busiestHour": 3,                                       // 3 = 3AM
    "lateNightSessions": 0,                                 // sessions after midnight
    "longestStreakDays": 0,
    "heatmap": [ /* 365 values */ ]
  },
  "phrases": {
    "fixIt": 0,                                             // "fix it", "still broken", "why", "please"
    "stillBroken": 0,
    "please": 0,
    "thanks": 0
  },
  "longestSession": { "project": "...", "minutes": 0, "date": "..." }
}
```

Timezone: compute hours/days in the user's local timezone, not UTC.

---

## 9. Story layer (story.json)

Claude writes, from stats + samples:
- **Coder personality** — a title + one line (e.g. "The 3AM Shipper", "The Rewriter", "The Polite One", "The Speedrunner"). Pick from a fixed list defined in the skill so results stay consistent and fun, plus a custom line.
- **Your year in projects** — one line per top project ("lumen: 41 sessions, mostly fighting auth").
- **Hardest bug** — the session with the most back-and-forth on one problem, summarized in one line.
- **Funny lines** — e.g. "You said 'still broken' 89 times." Must be based on real counts from stats.json — never invent numbers.
- **Closing line** for the last scene.

Rules for Claude in this stage:
- Only use numbers that exist in stats.json.
- Never quote anything that looks like a secret, a name of a private person, or client info.
- Keep every caption short enough to read in ~2 seconds.
- Tone: playful roast, never mean.

---

## 10. Video scenes (first draft)

1. Intro — "Your 2026 in AI coding" + tool logos as plain text (no trademarked logos)
2. Total hours + sessions (counter animation)
3. Heatmap of the year filling in
4. Busiest hour ("You peaked at 3AM")
5. Top projects
6. Top tools used (Bash / Read / Edit bars)
7. Funny stat ("You said 'still broken' 89 times")
8. Hardest bug
9. Coder personality reveal (the shareable moment)
9b. **What you shipped:** top repos, AI share of commits, biggest ship day (§20). Skipped if there are no commits that month
Every scene opens with a short rewind-glitch transition (DESIGN.md).

10. Outro — personality card + "made with rewynd" + repo link (this is the growth loop — every shared video advertises the project)

Music: only royalty-free / CC0 tracks, or let the user add their own. Don't ship copyrighted music.

---

## 11. Privacy rules (non-negotiable)

- 100% local. No network requests, no telemetry, no uploads. **Only exception:** `/rewynd --github` (opt-in, §20), which talks to GitHub through the user's own `gh` login and is the only network code in the project.
- Never send raw logs to Claude. Only stats + a small redacted sample, after asking.
- Redact secrets before any sample is written to disk.
- Saved days (`data/days/`) store aggregates only: counts, hours, project names, agent names, phrase counts. **Never prompt or message text.**
- **rewynd never writes to any agent's settings or files.** Read-only, always.
- `data/` is git-ignored, and rewynd warns if it's ever tracked by git (§19).
- Output files (`stats.json`, `samples.json`, video) go in a local output folder that is git-ignored.
- README must clearly explain what is read, what is stored, and what Claude sees.

---

## 12. Suggested repo structure

```
rewynd/
├── README.md
├── LICENSE                      # MIT
├── skills/
│   ├── rewynd-setup/SKILL.md
│   ├── rewynd/SKILL.md
│   ├── rewynd-card/SKILL.md
│   └── rewynd-status/SKILL.md
├── scripts/
│   ├── collect.ts               # stage 1 entry: builds stats.json + samples.json
│   ├── sources/                 # one adapter per agent, see §18
│   │   ├── types.ts             # shared normalized Session/Message/ToolCall
│   │   ├── claude-code.ts       # streams ~/.claude logs
│   │   ├── codex.ts             # streams ~/.codex logs (.jsonl + .jsonl.zst)
│   │   ├── gemini.ts            # v0.2
│   │   ├── opencode.ts          # v0.2 (SQLite, read-only)
│   │   └── cursor.ts            # later / optional
│   ├── shipped/                 # §20
│   │   ├── find-repos.ts        # agent project folders → unique git repos
│   │   ├── git-log.ts           # streams `git log`, your commits only, counts only
│   │   ├── ai-match.ts          # Claude trailer + Codex matching tiers
│   │   └── github.ts            # --github only: the one network file (via `gh`)
│   ├── redact.ts                # secret scrubbing
│   ├── store/                   # rewynd's own daily store, see §19
│   │   ├── day.ts               # DayRecord type + build a day from normalized sessions
│   │   ├── save-days.ts         # write new/grown days, never shrink a saved one
│   │   ├── load-days.ts         # read days for a range → feeds stats.json
│   │   └── git-guard.ts         # warns if data/ is tracked by git
│   └── render.ts                # calls Remotion render / renderStill
├── video/                       # Remotion project (the template)
│   ├── src/Root.tsx
│   ├── src/Rewynd.tsx           # main composition
│   ├── src/scenes/*.tsx         # one file per scene
│   └── src/schema.ts            # Zod schema for props
├── data/                        # git-ignored, rewynd's own memory, preserved across updates
│   ├── days/YYYY-MM-DD.json     # one file per day, aggregates only
│   └── preferences.json         # saved design choices
└── output/                      # git-ignored, regenerated every run
```

Stack: Node + TypeScript everywhere (Remotion is React/TS, so one language for the whole project).

---

## 13. Milestones (today is Oct 22, 2026)

| When | Milestone |
|---|---|
| Week 1 (by ~Oct 29) | Inspect real log files on own machine; write `collect.ts` for Claude Code; stats.json working |
| Week 2 (by ~Nov 5) | Codex support; daily store (`data/days/`) + `/rewynd-status`; README. **Ship v0.1 (saving days + status) with the "your history is being deleted" message** |
| Weeks 3–4 (by ~Nov 19) | Remotion template + `/rewynd-card` |
| Weeks 5–6 (by ~Dec 1) | Story layer, full video, polish. **Ship v1.0, timed with year-in-review season (early December)** |

---

## 14. Launch plan (short)

- v0.1 post (November): "Claude Code silently deletes your history after 30 days. rewynd saves your daily totals (never your messages, never touches your settings) so your recap works in December." Useful on its own → early stars.
- v1.0 post (December): post your OWN rewynd video. The video is the demo.
- Every video ends with "made with rewynd" + link → each share brings new users.
- Post in Claude Code / Codex communities, r/ClaudeAI, X.

---

## 15. Open questions to decide while building

- [ ] Exact JSONL formats for both tools (inspect real files first)
- [ ] Does `history.jsonl` survive past 30 days? Does `stats-cache.json` hold anything useful?
- [x] ~~SessionStart hook vs manual snapshots~~ → manual: days are saved on every rewynd run, with no hooks (§19)
- [ ] How to keep install light: Remotion needs npm deps + a headless browser download on first render. Card-only mode should work without the full video setup if possible.
- [ ] Codex skills compatibility — same skill folder for both tools, like other skills?
- [ ] Name availability on npm + GitHub (check before launch)

---

## 16. Coding conventions for this project

- **Every file gets comments explaining what each part does and why** — the developer learns best from commented code. Explain non-obvious logic in plain language, not just what the line does.
- TypeScript, small files, one job per file.
- Stream large files; never `readFileSync` a log file.
- No network calls anywhere in the codebase, except `scripts/shipped/github.ts`, which only runs with `--github` and only through the `gh` CLI (§20).

---

## 17. Sources (for verification)

- Claude Code `~/.claude` directory docs: https://code.claude.com/docs/en/claude-directory
- 30-day deletion reports: https://github.com/anthropics/claude-code/issues/62959 · https://itdaily.com/news/cloud/claude-code-deletes-conversation-history-after-30-days-by-default/ · https://brycewatson.com/blog/28-claude-code-deletes-old-logs
- Codex session location: https://inventivehq.com/knowledge-base/openai/where-configuration-files-are-stored
- Codex huge session files: https://github.com/openai/codex/issues/24948
- Codex `.jsonl.zst` rollouts: https://codex.danielvaughan.com/2026/04/11/codex-cli-session-lifecycle-resume-fork-rollouts
- Competitors: https://github.com/levifig/cc-wrapped · https://classic.yarnpkg.com/en/package/claude-code-wrapped · https://libraries.io/npm/claude-year-in-review · https://github.com/lfgcampos/agent-wrapped/releases · https://github.com/htin1/code-wrapped · https://agentboard.cc/
- Remotion + Claude Code skill: https://blog.openreplay.com/making-videos-claude-code-remotion/

---

## 18. Multi-agent support

> Added Oct 22, 2026. This section **overrides** older sections that say "Claude Code + Codex" only (§1, §3, §5, §6, §12). Where they conflict, follow this one.

### Goal
rewynd detects every AI coding agent that has data on the machine and puts all of them in **one** recap. Supporting many agents is expected now (agents-wrapped, tokscale and agent-lens already do it), so it isn't our edge. The edge is still **the video + the story**. Multi-agent mainly unlocks a new **"Your main AI"** scene.

### Architecture: one adapter per agent

```
scripts/sources/
├── types.ts          # shared normalized types — the only shapes the rest of the code sees
├── paths.ts          # home/OS/env-var path resolution, shared by all adapters
├── claude-code.ts
├── codex.ts
├── gemini.ts
├── opencode.ts
└── cursor.ts         # later / optional
```

Every adapter exports the same interface:

```ts
interface AgentAdapter {
  id: AgentId;                      // "claude-code" | "codex" | "gemini" | "opencode" | "cursor"
  label: string;                    // plain-text display name, e.g. "Claude Code" (no logos)
  detect(): Promise<{ found: boolean; paths: string[]; note?: string }>;
  collect(range: DateRange): AsyncIterable<Session>;  // streams, one session at a time
}
```

- `types.ts` defines `Session`, `Message`, `ToolCall`, each with an `agent: AgentId` field. Everything after the adapters (stats, samples, story, video) only uses these types and never cares which agent the data came from.
- `Session` carries an `origin: "human" | "automated"` flag. Background runs (Codex guardian reviews, sub-agents, API-driven sessions) are kept but marked `automated`, so they don't inflate "sessions you started" (see findings below).
- `collect.ts` loops over all adapters, runs `detect()`, and only collects from agents that are found.
- **One adapter failing never crashes the run.** Each adapter runs inside try/catch. On error (bad format, missing package, unreadable file) we log one clear warning (`⚠ Skipped Gemini CLI: <reason>`) and continue with the others. The recap says which agents were included.

### Data locations

Verified on a test Mac on Oct 22, 2026 (see findings). Formats change between versions, so re-check before each release.

| Agent | Location (macOS / Linux) | Windows | Env override | Format |
|---|---|---|---|---|
| Claude Code (CLI + desktop) | `~/.claude/projects/<path-slug>/<session>.jsonl` (+ `<session>/subagents/*.jsonl`) | `%USERPROFILE%\.claude\…` | `CLAUDE_CONFIG_DIR` | JSONL |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` **and** `.jsonl.zst`, plus `~/.codex/archived_sessions/` | `%USERPROFILE%\.codex\…` | `CODEX_HOME` | JSONL (zstd) |
| Gemini CLI | `~/.gemini/tmp/<project>/chats/*.jsonl` (older: `<project_hash>/chats/*.json`) | `%USERPROFILE%\.gemini\…` | `GEMINI_DATA_DIR` (verify name) | JSONL patch log / JSON |
| OpenCode | `$XDG_DATA_HOME/opencode/opencode.db` (default `~/.local/share/opencode`), older: `storage/message/**/*.json` | `%LOCALAPPDATA%\opencode\…` (verify) | `XDG_DATA_HOME` | SQLite / JSON |
| Cursor | macOS `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` (+ `workspaceStorage/*/state.vscdb`); Linux `~/.config/Cursor/User/…` | `%APPDATA%\Cursor\User\…` | — | SQLite, undocumented |

### What we found on a test machine (Oct 22, 2026)

| Agent | Found? | What we saw | Impact on the adapter |
|---|---|---|---|
| Claude Code | ✅ several GB | About a hundred transcripts, roughly a quarter of them sub-agent files. **Nothing older than a couple of weeks.** `cleanupPeriodDays` isn't set, so older history is already gone. Records: `user`, `assistant` (has `message.model`, `message.usage` with input/output/cache tokens), `system`, `attachment`, `queue-operation`, `custom-title`, `agent-name`, `file-history-snapshot`. Each line has `sessionId`, `cwd`, `timestamp`, `version` (2.1.286), `entrypoint` (`claude-desktop` / CLI) | Count only `user` records with `origin.kind == "human"` as user messages; tool results also arrive as `user` records. Mark sub-agent files `automated`. Proof that `/rewynd-setup` matters |
| Codex | ✅ several GB, plus archived | Over a thousand rollouts spanning months. **Most are `.jsonl.zst`** (compressed). Single files reach **hundreds of MB**. Only **~1 in 5 was started by the user** (`thread_source: "user"`, source `vscode`/`cli`/`exec`). **The rest are automated**: mostly `guardian_review`, plus sub-agents. Records: `session_meta`, `turn_context`, `response_item` (`message`, `function_call`, `custom_tool_call`, `reasoning`, `compaction`), `event_msg` (`token_count`, `task_started`, `task_complete`), `token_usage_record`, `world_state` | zstd is required from day one. Must stream. Must split human vs automated, or session counts are inflated ~5×. Tokens come from the last `token_count.total_token_usage` per session |
| Gemini CLI | ⚠️ hundreds of MB in `tmp/` | Thousands of chat files, **all named `*-a2a-serv.jsonl`** (`sessionId: "a2a-server"`), almost all from a single month. Format: one header line (`projectHash`, `startTime`, `kind`) then `{"$set": {"messages": [...]}}` patch lines. In a large sample **every message is `type: "user"` with no model replies**, and prompts are ~6k chars | These look like **Gemini CLI running as an A2A server driven by another tool**, not chats typed by hand. Default them to `automated` and confirm with the developer. The adapter also needs to handle the classic interactive `session-*.json` format, which isn't on this machine to test against |
| Antigravity (Google) | ➕ not in the original list | `~/.gemini/antigravity/conversations/*.db`: 12 SQLite DBs (tables `steps`, `trajectory_meta`, `gen_metadata`, …) | Candidate extra adapter, "later / optional" tier like Cursor |
| OpenCode | ⚠️ folder only | `~/.local/share/opencode` has only `repos/` and `log/`, **no `opencode.db`** and no `storage/` | `detect()` must check for the DB/storage, not just the folder. Here it reports "installed, no sessions". Need test data from another machine |
| Cursor | ❌ | Not installed | Need a test machine with Cursor before building it |

### Dependencies: prefer what Node already has
The developer runs Node 24, and Node now ships two things we need:
- **zstd:** `zlib.createZstdDecompress()` (Node ≥ 22.15 / 23.8). Codex `.zst` files stream through it, with no npm package.
- **SQLite:** `node:sqlite` (`new DatabaseSync(path, { readOnly: true })`, Node ≥ 22.13). This covers OpenCode, Cursor and Antigravity **without a native package**.
- Fallback order for SQLite: `node:sqlite` → `better-sqlite3` as an **optionalDependency** → skip SQLite-based agents with a clear message ("Skipped OpenCode: needs Node 22.13+ or better-sqlite3"). Never fail the whole run.
- Set the minimum Node version in `package.json` `engines` once this is decided (proposal: `>=22.13`).

### Safety rules for multi-agent (on top of §11)
- Open every database **read-only**, and never write to any agent's files. For SQLite, also open with `immutable`-style read-only so a running agent's DB isn't locked or changed. If the DB is locked, skip it with a warning instead of waiting or copying.
- Stream large files line by line. Never load a whole log into memory, since Codex files reach hundreds of MB and Cursor's `state.vscdb` can be ~1.5 GB.
- 100% local, no network calls.
- Only aggregates go into `stats.json`. Only a small redacted sample goes to Claude, and samples come from `origin: "human"` sessions only.
- **Never** modify any agent's settings or files, including Claude Code's `cleanupPeriodDays`. Retention is handled by rewynd's own daily store (§19).

### Cursor caveats
- `state.vscdb` can be ~1.5 GB and its internal format is undocumented, so the adapter can break whenever Cursor updates. Treat it as best-effort and label it "experimental" in the recap.
- It needs SQLite (see Dependencies above).

### Release order
| Version | Agents |
|---|---|
| v0.1 | Claude Code + Codex (already planned) |
| v0.2 | Gemini CLI + OpenCode |
| Later / optional | Cursor, Antigravity |

### `stats.json` changes

```jsonc
{
  "agents": ["claude-code", "codex"],                     // detected + collected
  "skippedAgents": [{ "id": "opencode", "reason": "installed, no sessions" }],
  "byAgent": {
    "claude-code": { "sessions": 0, "automatedSessions": 0, "userMessages": 0,
                     "toolCalls": 0, "tokensIn": 0, "tokensOut": 0, "activeHours": 0 },
    "codex": { /* same fields */ }
  },
  "mainAgent": "claude-code",                             // most-used, by human active hours
  "agentShare": [ { "agent": "claude-code", "share": 0.62 }, { "agent": "codex", "share": 0.30 } ],
  "agentSwitches": {
    "sameDay": 0,                                         // days where you used 2+ agents
    "sameProject": 0,                                     // times you moved a project from one agent to another
    "topSwitch": { "from": "claude-code", "to": "codex", "count": 0 }
  }
}
```

- **Share** is based on human active hours, not raw session counts, so automated runs and one-line sessions don't skew it. Shares are rounded so they add up to 100.
- **Switch** = two consecutive human sessions, in date order, by different agents on the same day (`sameDay`) or in the same project folder (`sameProject`). Project matching uses the normalized `cwd`.
- Existing `totals` stay, summed across agents (human sessions only, with `automatedSessions` reported separately).

### New video scene: "Your main AI"
- Shows the share per agent as huge numbers / bars, e.g. `Claude Code 62% · Codex 30% · Cursor 8%`. Agent names are **plain text, never logos**.
- One fun line built only from real counts, e.g. "You cheated on Claude Code with Codex 41 times" (uses `agentSwitches.topSwitch.count`).
- **Only shown if 2+ agents were detected with human sessions.** Otherwise the scene is skipped and the video is just shorter.
- Slot: after "Total hours + sessions" (scene 2), before the heatmap.

### Design note
**Updated Oct 22, 2026: rewynd has its own identity now, "tape rewind meets terminal".** Spotify Wrapped is no longer the reference. Its signature elements (concentric circles, squiggle lines, checkerboards, highlighted label boxes) are removed.
- Tape / camcorder: REC dot, timecode counters (`▶ 00:86:12`), subtle scan lines, a PLAY / ◀◀ REW bar, tape labels ("OCTOBER '26").
- Code: terminal windows, +green / -red diff colors, tabular (monospace-width) numbers, blinking cursor. The "3AM Shipper" personality card is the reference.
- Kept: huge numbers, bold color fields, one stat per card, the personality reveal.
- Every scene starts with a short rewind-glitch transition.
- One font everywhere: **Inter** (Poppins dropped). Users can still choose their own font file (DESIGN.md §8).
- Agent and tool names are plain text, never logos. Tool names are agent-neutral: "Edit files", "Run commands", "Read files", "Search".
- Footer on every card: "made with rewynd" + the repo URL, since screenshots lose links.
- Full spec: DESIGN.md.

### Background runs → a joke line
- Automated sessions (Codex `guardian_review`, sub-agents, Gemini `a2a-server`, Claude Code sub-agent files) are **never** counted in sessions, hours, messages or agent share.
- They are counted separately by kind and saved per day (`data/days/` → `agents.<id>.automated: { "review": 0, "subagent": 0, "other": 0 }`), so the counts survive deletion like everything else.
- `stats.json` gets `backgroundRuns: { total, byAgent: { codex: { review: 120, subagent: 40 } } }`.
- The story layer may use **one** fun line from these real counts, e.g. "Codex double-checked itself 120 times" or "Your agents spun up 40 little helpers". Same rules as §9: only real numbers, playful, never mean.
- If there are no background runs, there's no line.

### Code style
Comment every file, explaining what each part does and why in plain language (same as §16).

### Open questions from the findings
- [x] ~~Gemini `a2a-server` sessions~~: decided (Oct 22) not to investigate. They're treated as `automated` by default (no model replies, machine-sized prompts).
- [x] ~~Automated sessions in the video?~~ Decided (Oct 22): **turn them into a joke line.** They stay out of every human count and the agent share, but their real counts feed one fun line, e.g. "Codex double-checked itself 120 times" or "Your agents spun up 40 helpers". See "Background runs" below.
- [x] ~~Antigravity~~: decided (Oct 22): yes, "later" tier with Cursor.
- [ ] Minimum Node version (`>=22.13` gives us built-in zstd + SQLite).

---

## 19. Data retention: rewynd's own daily store

> Added Oct 22, 2026. Replaces the old plan of raising `cleanupPeriodDays`. **rewynd never changes any agent's settings.**

### The idea
Agents delete old transcripts (Claude Code: 30 days by default). Instead of fighting that, rewynd writes down **one small summary per day** in its own folder. Once a day is saved, the transcripts can disappear and the day is still complete. Monthly and yearly recaps are built from these saved days.

### Where
```
<rewynd folder>/data/
├── days/
│   ├── 2026-10-21.json
│   └── 2026-10-22.json
└── preferences.json          # design choices (DESIGN.md §8)
```
- `<rewynd folder>` = the root of the installed skill/repo (found from the script's own location, not the current working directory).
- `REWYND_DATA_DIR` env var overrides it, for people who want their data somewhere else.

### What a day file holds (aggregates only)
```jsonc
{
  "schemaVersion": 1,
  "date": "2026-10-22",                 // local date in the user's timezone
  "timezone": "America/New_York",
  "savedAt": "2026-10-22T05:10:00-04:00",
  "agents": {
    "claude-code": {
      "sessions": 6, "automatedSessions": 2,
      "userMessages": 41, "toolCalls": 212,
      "tokensIn": 0, "tokensOut": 0,
      "activeMinutes": 185,
      "models": { "claude-opus-5-5": 41 },
      "tools": { "Edit": 60, "Bash": 55, "Read": 40 }
    },
    "codex": { /* same fields */ }
  },
  "hours": [0, 0, 3, 12 /* … 24 buckets of active minutes, for "busiest hour" */],
  "projects": [
    { "name": "rewynd", "agents": ["claude-code", "codex"], "sessions": 3, "minutes": 120,
      "firstAt": "09:12", "lastAt": "13:40" }
  ],
  "switches": { "sameDay": 2, "pairs": { "claude-code>codex": 2 } },
  "phrases": { "fixIt": 3, "stillBroken": 1, "please": 9, "thanks": 4 },
  "longestSession": { "project": "rewynd", "agent": "claude-code", "minutes": 95 }
}
```
- **Never** prompt text, message text, file contents, code, or paths beyond the project folder's *name*.
- `hideProjectNames` (DESIGN.md §8) only affects the video. Names are still saved locally so the user can change their mind later.
- Streaks, busiest day, heatmap and totals are all computed from the days, so they don't need to be stored separately.

### Saving rules
1. Every rewynd command (`/rewynd`, `/rewynd-card`, `/rewynd-status`, `/rewynd-setup`) runs the save step first.
2. The first run **backfills every day still on disk** for every detected agent. On a typical machine that can reach back months for Codex but only ~30 days for Claude Code.
3. **A day that's already saved is never overwritten with less data.** Compare **per agent**: for each agent in the day, keep whichever version (saved or freshly computed) has more data, using `userMessages`, then `activeMinutes`, as the measure. This handles both cases:
   - Today, or a day still on disk with new sessions → fresh data is bigger → update.
   - An old day whose transcripts were deleted → fresh data is smaller or empty → keep the saved version.
   - A new agent adapter added later (e.g. Gemini in v0.2) → that agent's numbers get *added* to already-saved days without touching the others.
4. Writes are atomic: write to `YYYY-MM-DD.json.tmp`, then rename, so a crash never leaves a half-written day.
5. Day boundaries use the user's local timezone. A session that crosses midnight is split by message timestamps.
6. If `schemaVersion` changes, old days are migrated on read, never deleted.

### Recaps from saved days
- `stats.json` for any range (a month, the year) is built by loading the saved days in that range, never straight from transcripts.
- The **story samples** (§9) still come from transcripts, because we never store message text. So the story covers what's still on disk (~the last 30 days for Claude Code), while the numbers cover the whole year. The story prompt should be told this.
- Gaps (days never saved because rewynd wasn't run within 30 days) show up in `/rewynd-status`, and the video's heatmap shows them as empty, not as zero activity. If a gap is large, the recap says so honestly.

### Git safety
- `data/` is in `.gitignore`, so no one's personal stats get pushed to GitHub.
- `git-guard.ts` runs on every command. If the rewynd folder is a git repo and `git ls-files data/` returns anything (data was force-added or the ignore rule was removed), it prints a loud warning with the fix (`git rm -r --cached data/`). It only warns and never changes git state itself.
- The guard is also run by the repo's own tests/CI, so a contributor can't accidentally commit sample data.

### Updates and reinstalls must keep `data/`
- `git pull` is safe: ignored files are left alone.
- **Risk:** some install methods replace the whole folder. A plugin update can unpack into a new versioned folder, and `rm -rf` + re-clone wipes `data/`. Mitigations:
  - README section "Updating rewynd without losing your history", with exact steps for each install method.
  - On startup, if `data/days/` is empty, rewynd looks for a previous install's `data/` in known locations and offers to copy it over (it asks first).
  - `REWYND_DATA_DIR` lets cautious users keep data outside the install folder entirely.
- Open question: verify how the Claude Code plugin/skill install and update flow treats extra files in the skill folder, **before v0.1**.

### README must say clearly
> **rewynd never changes your agent settings, never stores your messages, and only keeps daily totals in its own folder (`data/`).**

Plus: exactly what's in a day file, that `data/` is git-ignored, how to update without losing it, and how to delete it (just delete the folder).

---

## 20. Shipped: git + GitHub

> Added Oct 22, 2026. Adds a "What you shipped" section: how much you committed, and how much of it was done with AI.

### Part 1: local git (default, no network)

**Which repos.** Start from the project folders (`cwd`) in the agent logs, so we only scan repos the user actually worked on with AI:
1. Collect every `cwd` from human sessions of every detected agent (§18).
2. Resolve each one to its repo with `git rev-parse --show-toplevel`, then **dedupe by `--git-common-dir`** so worktrees (`.claude/worktrees/*`, `.codex/worktrees/*`) count as their main repo.
3. Folders that no longer exist or aren't git repos are skipped silently and counted in `/rewynd-status`.
4. Optional later: `--repos <dir>` to scan extra folders.

On a test machine, over a hundred session folders resolved to **a few dozen unique repos**; many sessions weren't in a repo or pointed to folders that no longer exist.

**Whose commits.** Only the user's own commits count. "Mine" = the global `git config user.email` + every repo-local `user.email`, plus an optional `gitEmails` list in `data/preferences.json`. Commits authored by Claude itself (`@anthropic.com` author, e.g. cloud sessions) also count as the user's, marked AI. Collaborators' commits are excluded. Emails are used for matching only and are **never saved** to day files.

**What we count** (per day, for every day in range): commits (non-merge, **reachable from the default branch only**, deduped by hash), AI commits, lines added/removed, commits per repo, biggest ship day.
- **Lines added/removed exclude noise:** lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `*.lock`, `Podfile.lock`), `node_modules/`, `dist/`, `build/`, `.next/`, minified files (`*.min.*`), snapshots, and binary files. Without this, a busy month can show hundreds of thousands of lines added, mostly generated files. Also cap any single file's contribution per commit (e.g. 5,000 lines), so one vendored dump can't dominate.
- Commit messages and code are **never** read into stats. We use `git log --numstat` with only hash, author email, date and trailers.

**How we tell a commit was made with AI.** Checked against ~10 months of real commits in AI-touched repos:

| Agent | Marker found | Rule |
|---|---|---|
| Claude | ✅ **Most AI commits** have `Co-Authored-By: Claude <Opus/Sonnet/Fable> <noreply@anthropic.com>`; a few are authored by an `@anthropic.com` noreply; a few have a `Claude-Session` trailer | AI = any of these. Match case-insensitively (both `Co-Authored-By` and `Co-authored-by` appear). Certain |
| Codex | ❌ **No trailer or author marker.** "codex" only shows up in commit subject/body text (e.g. features about Codex). But **many local branches are named `codex/*`**, Codex's branch prefix | Tiers below |
| Copilot | ➕ A few commits co-authored by `Copilot <copilot@github.com>` | Counts as AI (decided Oct 22), reported as `copilot` |

**Codex matching, in tiers (best first):**
1. **Exact:** the commit's hash appears in a Codex session's command output (`git commit` prints `[branch abc1234] …`). Certain. Note: only about 1 in 9 plain Codex logs mention `git commit` at all, so this alone will catch few.
2. **Branch:** the commit was made on a `codex/*` branch. Found from the local reflog (`.git/logs/refs/heads/codex/*`) or by being reachable from a `codex/*` branch tip and not from the default branch at that time. Strong. The reflog expires after ~90 days, which is one more reason to save days as we go.
3. **Time + project:** the commit's author time falls inside a **human** Codex session window (session start → last event + 15 min) in the **same repo**, and it has no Claude marker. Likely.
- If a commit matches both a Claude session window and a Codex one and has no trailer, it's "AI, unknown agent".
- `stats.json` keeps the tier breakdown. The video's AI share uses Claude-certain + Codex exact/branch/time by default, but any **funny line about Codex commits only uses tiers 1–2**, so we never roast someone based on a guess.

**Saved to `data/days/`** like everything else (§19), under a `git` key. Counts only:
```jsonc
"git": {
  "commits": 31, "linesAdded": 1840, "linesRemoved": 620,
  "ai": { "claude": 24, "codex": { "exact": 0, "branch": 2, "time": 1 }, "unknown": 0 },
  "repos": { "lumen": { "commits": 12, "ai": 10, "linesAdded": 900, "linesRemoved": 210 } }
}
```
Same never-shrink rule: if a repo is later deleted or moved, its saved days stay.

**Preview from a test machine** (before the noise filter): about **80% of the user's commits had a Claude trailer**.

### Part 2: GitHub (optional, opt-in only)
- Runs **only** with `/rewynd --github`, and **only** if `gh auth status` succeeds. rewynd never asks for, reads, or stores a token. Everything goes through the user's existing `gh` CLI login (`gh api …`).
- If `gh` is missing or logged out: one clear message ("Skipping GitHub: run `gh auth login` first"), then continue without it.
- Pulled for the chosen month, for repos the user owns:
  - **Merged PRs** authored by the user (`is:pr is:merged author:@me merged:<range>`)
  - **Releases** published (`published_at` in range)
  - **New stars** (stargazers with `starred_at`, via the `application/vnd.github.star+json` media type)
- Saved per day under a `github` key in `data/days/` (counts only, no PR titles or bodies).
- Read-only API calls only. rewynd never writes to GitHub.
- All network code lives in one file, `scripts/shipped/github.ts`, so it's easy to audit.
- **README:** "This is the only part of rewynd that uses the network, and only when you pass `--github`."

### New `stats.json` fields
```jsonc
"shipped": {
  "commits": 641,
  "aiCommits": 512,                        // Claude + Codex (all tiers) + unknown
  "aiCommitsByAgent": { "claude-code": 507, "codex": 5, "unknown": 0 },
  "codexConfidence": { "exact": 0, "branch": 3, "time": 2 },
  "aiShare": 0.80,                         // aiCommits / commits
  "linesAdded": 0, "linesRemoved": 0,      // after the noise filter
  "byRepo": [ { "name": "harbor-api", "commits": 128, "aiShare": 0.88 } ],
  "biggestDay": { "date": "2026-10-21", "commits": 38 },
  // only with --github:
  "prsMerged": 0, "releases": 0, "starsGained": 0
}
```

### New video scene: "What you shipped"
- Top repos (ranked list), AI share of commits as a huge number ("80% of your commits had an AI co-author"), biggest ship day.
- With `--github`: a line like "12 PRs merged · 2 releases · +40 stars".
- **Skipped if there are no commits that month.**
- `hideProjectNames` (DESIGN.md §8) applies to repo names too.
- Slot: after "Top projects" (scene 5).

### Open questions
- [x] ~~All branches or default branch?~~ Decided (Oct 22): **only commits that reached the default branch** (main/master, or whatever `origin/HEAD` points to). Unmerged branch work doesn't count as shipped. The Codex "branch" tier still works, because merged `codex/*` commits are on main.
- [x] ~~Copilot co-authors?~~ Decided (Oct 22): **yes**, they count as AI (`aiCommitsByAgent.copilot`).

---

## 21. Implementation status (built Oct 22, 2026, overnight)

Everything in §1–§20 is implemented, except where noted below. Run `npm test` (28 tests) and `npm run typecheck` (+ `cd video && npx tsc --noEmit`).

### What exists
| Part | Where | Notes |
|---|---|---|
| Shared contract | `contract/recap.ts` | `Stats`, `Story`, `DesignPrefs`, `RecapProps`, personalities, scene order, `REPO_URL` (= `github.com/notsocj/rewynd`, repo not created yet) |
| CLI | `scripts/cli.ts` | `collect`, `save`, `status`, `story-check`, `themes`, `prefs`, `render [--card]`, `migrate-data`, `guard`. Prints one JSON object on stdout |
| Adapters | `scripts/sources/` | Claude Code, Codex (.jsonl + .zst, code-mode `exec` tool), Gemini CLI (patch-log .jsonl + old .json), OpenCode (SQLite + JSON storage, **beta: tested on synthetic data only**), Cursor + Antigravity **detect-only** |
| Daily store | `scripts/store/` | day files, never-shrink merge, coverage (seen vs gap), git guard, counting-rules version (`ALGO_VERSION`) |
| Shipped | `scripts/shipped/` | default branch only, your emails only, noise filter, Claude/Copilot trailers, Codex exact/branch(reflog)/time tiers, `github.ts` (`--github`, via `gh` only) |
| Stats / samples / story | `scripts/stats/`, `scripts/samples/`, `scripts/story/` | personality ranking, ≤150 redacted samples (280 chars), story validator (numbers must exist in stats.json) |
| Render | `scripts/render/` | theme resolution (`video/src/themes.json`), scene picking, Project A/B/C anonymizing, custom font/music staging, first-run `npm ci` in `video/`, random `--port` |
| Video template | `video/` | 12 scenes, 4 themes, 9 badges, `Rewynd` + `RewyndCard`, vertical + wide. Built by the sample-cards session; see DESIGN.md |
| Skills | `skills/rewynd*/SKILL.md` | Claude Code plugin + Codex (`~/.agents/skills` symlinks). Paths: `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` with fallbacks |
| Plugin | `.claude-plugin/plugin.json`, `marketplace.json` | `claude plugin validate` passes for both |
| Docs | `README.md`, `docs/*.png` (fake-data frames), `LICENSE` (MIT) | |

### Decisions made while building (and why)
- **Plugin installs keep `data/` in `${CLAUDE_PLUGIN_DATA}`, not in the plugin folder.** Claude Code installs each plugin version into a new folder (`~/.claude/plugins/cache/<market>/<plugin>/<version>/`) and sweeps old ones after 14 days, so a `data/` inside it would be lost on update. `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/rewynd-rewynd/`) survives updates, but is deleted on uninstall unless `--keep-data` is passed (README says so). Clone/Codex installs keep `<repo>/data/` as originally planned. `REWYND_DATA_DIR` overrides both. `migrate-data` + `/rewynd-status` copy days from older installs.
- **No runtime dependencies at the root.** Node ≥ 22.18 runs the `.ts` files directly (type stripping) and has zstd + `node:sqlite` built in. `better-sqlite3` is used only if the user already has it installed; it's NOT in `optionalDependencies`, because that would make every install try to compile a native module. The root `package-lock.json` is git-ignored, so Claude Code doesn't auto-install TypeScript into the plugin folder.
- **Own line reader.** Node's `readline` splits on U+2028/U+2029, which occur inside real Codex messages and corrupted JSON lines.
- **Active time** = events joined when gaps are ≤ 15 min, and only up to 60 min after your last message (an agent looping alone doesn't count as your time). Parallel sessions count once per day, but fully per agent.
- **Human vs background:** Codex `guardian_review` + sub-agents, Claude Code sub-agent files/sidechains, Gemini `a2a-server` chats, OpenCode child sessions, and sessions where nobody typed are "automated". They are counted per day (`automated.review/subagent/other`) and only feed `backgroundLine`.
- **Codex `exec` tool:** newer Codex runs a JS snippet that calls `tools.exec_command(...)`, `tools.apply_patch(...)` etc.; we count the inner calls. (A naive regex here backtracked exponentially on real logs, fixed and commented.)
- **Codex branch tier uses reflogs only**, not "reachable from codex/* branches", which would wrongly credit Codex with all of main's older history.
- **Hours** in story text use `floor(activeMinutes / 60)`, matching the video.
- Personality ranking sorts by an unclamped raw score so ties at 1.0 still have a winner.

### First real run (Oct 22)
Verified end to end on a real machine: months of saved days from many GB of logs in well under a minute. A numbers-only story (samples not read, no consent given yet) rendered `output/rewynd-2026-10.mp4` + `output/rewynd-card-2026-10.png`.

### Known gaps / next steps
- [ ] OpenCode: verify against a real `opencode.db` (schema assumed from OpenCode's source).
- [ ] Cursor + Antigravity readers ("later" tier).
- [ ] Verify Codex picks up `~/.agents/skills` symlinks and how it passes arguments (undocumented).
- [ ] `--github` hasn't been run against the real account yet (it's network; it waits for the user to ask).
- [x] Create the GitHub repo `notsocj/rewynd`, `git init`, first commit (Oct 22).
- [ ] Music: none bundled; only user-supplied.
- [ ] Windows paths are coded but untested.

---

## 22. Install with the skills CLI (Oct 22, 2026)

Primary install: `npx skills add https://github.com/notsocj/rewynd --skill rewynd` (the [skills CLI](https://skills.sh), v1.7.4 checked).

What the CLI does (read from its source):
- It copies **only the skill's folder** into `~/.agents/skills/<name>` and symlinks it into each agent (`~/.claude/skills`, Codex reads `~/.agents/skills` directly).
- `npx skills update` **deletes that folder** (`rm -rf`) before copying the new version.

What changed in rewynd because of that:
- **Everything rewynd runs moved into `skills/rewynd/`**: `scripts/`, `contract/`, `video/`, plus its own `package.json` (`"type": "module"`). Relative imports didn't change, because the three folders moved together. `test/skill-folder.test.ts` fails if any file inside imports something outside it.
- **One skill with modes** instead of four: `/rewynd`, `/rewynd card`, `/rewynd status`, `/rewynd setup` (`--skill rewynd` installs a single skill). The old `rewynd-card/status/setup` folders are gone.
- **Data location** (`scripts/lib/paths.ts`):
  1. `--data-dir`, which the Claude Code plugin sets to `${CLAUDE_PLUGIN_DATA}`
  2. `REWYND_DATA_DIR`
  3. `<repo>/data` when the skill sits inside a clone of the repo
  4. otherwise **`~/.rewynd`**, because a skills-CLI update would wipe a `data/` inside the skill folder. This replaces the original "data/ inside the rewynd folder" rule for skills-CLI installs; clones keep it.
- SKILL.md finds its scripts via `${CLAUDE_SKILL_DIR}` (works for plugin and plain skill installs), falling back to "the folder this SKILL.md is in" for other agents.
- The renderer runs Remotion through `node node_modules/@remotion/cli/remotion-cli.js`, not the `.bin` symlink, and treats deps as missing unless `@remotion/cli/dist/index.js` exists (copies with resolved symlinks broke the `.bin` launcher).
- Verified: installed into a throwaway home with the real CLI; `status` defaulted to `~/.rewynd/data`; `collect` read real history; a fresh first render installed deps + the headless browser and rendered the card in ~23 s. The tracked skill folder is ~0.7 MB.

---

## 23. Card templates (Oct 22, 2026)

From the "rewynd card directions" mockups: **Tape** (updated default), **Terminal**, **Receipt**, **Arcade**, each with 3 accents. `prefs.theme` is now a template id (or `"auto"` → per-personality template + accent from `themes.json`), plus a new `prefs.accent`. Old theme ids map onto templates. Hours, top tools and personality are hand-designed per template (vertical); every other scene and all wide layouts use the template-aware shared pieces. `stats.previous` (last period from saved days, with `changePct`) powers the "vs September" readouts. Details: DESIGN.md §9.
