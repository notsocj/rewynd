---
name: rewynd-setup
description: Optional first-run explainer for rewynd. Explains that Claude Code deletes transcripts after 30 days by default, saves the first batch of daily totals, and tells the user to run /rewynd at least once every 30 days. Changes no settings. Use when the user installs rewynd or asks how to keep their whole year.
---

# /rewynd-setup — keep your whole year (without touching any settings)

This command is optional. It explains one thing, saves what's on disk now, and changes **nothing** else.

## Paths
- **REWYND** = `${CLAUDE_PLUGIN_ROOT}`. If that wasn't replaced with a real path, it's the folder two levels above this SKILL.md (resolve symlinks).
- **DATA** = `${CLAUDE_PLUGIN_DATA}`. If it wasn't replaced, use `""`.
- Command: `node --disable-warning=ExperimentalWarning "REWYND/scripts/cli.ts" status --data-dir "DATA"` (Node 22.18+; if `node --version` is older, ask the user to update Node first).

## What to do
1. **Explain, in 3 short lines:**
   - Claude Code deletes session transcripts after **30 days** by default (`cleanupPeriodDays`). It's a deliberate security default: transcripts can contain code and secrets.
   - rewynd **doesn't change that setting** (or any agent setting). Instead it keeps its own **daily totals** (counts, hours, project names, never your messages) in its own `data/` folder.
   - Once a day is saved, it counts in every future recap, even after the transcripts are gone.
2. **Run `status`.** It saves every day still on disk (the first run can take ~30 seconds on a big history).
3. **Report** what was saved: number of days, the date range, and the agents found (one line each, using `agents[].note` for anything skipped).
4. **The one thing to remember:** "Run `/rewynd` or `/rewynd-status` **at least once every <cleanupPeriodDays> days**." Use `claudeRetention.cleanupPeriodDays`, and mention `claudeRetention.oldestDeletedOn` as the next day at risk.
5. If `gitGuard.ok` is false, warn and show `gitGuard.fix`. If `previousData` is non-empty, offer to copy it over (see `/rewynd-status`).
6. Finish with: "When you're ready for the video, run `/rewynd`."

## Never
- Never edit `~/.claude/settings.json` or any other agent's settings or files, even if the user asks rewynd to "fix" retention. If they want longer retention, point them to Claude Code's own `cleanupPeriodDays` setting and let them change it themselves.
