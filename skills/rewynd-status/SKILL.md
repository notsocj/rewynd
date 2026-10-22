---
name: rewynd-status
description: Show what rewynd has saved (days, gaps, date range per AI agent), what is still on disk, and when Claude Code will delete the oldest transcript. Also saves any new days. Use when the user asks about rewynd status, saved history, or whether their recap data is safe.
---

# /rewynd-status — what's saved, what's at risk

## Paths
- **REWYND** = `${CLAUDE_PLUGIN_ROOT}`. If that wasn't replaced with a real path, it's the folder two levels above this SKILL.md (resolve symlinks).
- **DATA** = `${CLAUDE_PLUGIN_DATA}`. If it wasn't replaced, use `""`.
- Command: `node --disable-warning=ExperimentalWarning "REWYND/scripts/cli.ts" status --data-dir "DATA"` (Node 22.18+).

## What to do
1. Run `status`. It **saves any new days first**, so the answer is current.
2. Summarize in a short list, plain language:
   - **Saved:** `saved.days` days, from `saved.first` to `saved.last` (this run: `saved.thisRun.created` new, `saved.thisRun.updated` updated). Data folder: `dataDir`.
   - **Agents:** one line each from `agents[]`: found or not, `humanSessions` you started, plus background runs. Use `note` when something is skipped (e.g. Cursor/Antigravity "support planned later", OpenCode "installed, no sessions").
   - **At risk:** from `claudeRetention`: Claude Code keeps transcripts `cleanupPeriodDays` days (`isDefault` = the 30-day default). The oldest transcript (`oldestTranscript`) is deleted around `oldestDeletedOn`. Days already saved are safe. Say: "Run /rewynd or /rewynd-status at least once every N days."
   - **Gaps:** if `saved.gapsLast90Days > 0`, list `gapRanges` as days rewynd never saw (it wasn't run in time). They can't be recovered. They show as "no tape" in the video, not as zero work.
3. If `gitGuard.ok` is false: warn that personal stats are tracked by git and show `gitGuard.fix` (don't run it yourself).
4. If `previousData` is non-empty (days saved by an older rewynd install), ask: "Copy N saved days from <dir> into your current rewynd?" On yes, run `migrate-data --from "<dir>"` (it copies, never moves, and never shrinks a saved day) and report the result.

## Never
- Never change `cleanupPeriodDays` or any other agent setting. rewynd only reads them.
