---
name: rewynd
description: Make a "tape rewind meets terminal" recap video of the user's month (or year) of AI coding from their local Claude Code, Codex, Gemini CLI and OpenCode history. 100% local. Use when the user asks for their rewynd, AI coding recap, year/month in review, or "wrapped" for coding agents.
argument-hint: "[YYYY-MM | --year YYYY] [--github]"
---

# /rewynd — your month of AI coding, as a video

You turn the user's local agent history into a short vertical video. Most of the work is done by scripts that cost zero tokens. Your jobs are to run them in order, ask the user a few short questions, and write a small, funny, honest `story.json`.

## Paths (work these out first)

- **REWYND** (the rewynd folder) = `${CLAUDE_PLUGIN_ROOT}`.
  If that still reads literally as `${CLAUDE_PLUGIN_ROOT}` (it wasn't replaced with a real path, e.g. in Codex or a plain skills install), REWYND is the folder **two levels above this SKILL.md** (this file is `REWYND/skills/rewynd/SKILL.md`; resolve symlinks with `realpath`).
- **DATA** = `${CLAUDE_PLUGIN_DATA}`. If it wasn't replaced with a real path, use an empty string `""` (rewynd then keeps its data in `REWYND/data`).
- Every command below is:
  `node --disable-warning=ExperimentalWarning "REWYND/scripts/cli.ts" <command> --data-dir "DATA" [flags]`
  Each prints ONE JSON object on stdout. Progress goes to stderr.
- Outputs go to `OUT` = `DATA/output` (or `REWYND/output` when DATA is empty).

Requirements: Node **22.18 or newer** (`node --version`). If it's older, tell the user to update Node and stop.

## Steps

### 1. Which period?
- If the user passed arguments (`$ARGUMENTS`), use them: `YYYY-MM` → `--month YYYY-MM`, `--year YYYY` → `--year YYYY`, `--github` → add `--github`.
- Otherwise ask one question. Default: the **previous month** if today is in the first 7 days of a month, else **this month so far**. In December, also offer "the whole year".

### 2. Collect (zero tokens)
Run `collect --month YYYY-MM` (or `--year YYYY`), adding `--github` only if the user asked for GitHub numbers.
- This also **saves every new day** into rewynd's own `data/days/` (daily totals only, never message text). That's what keeps the year complete after agents delete old transcripts.
- Tell the user in 2–3 lines: which agents were found (and any skipped, with the reason from `agents[].note`), how many days were saved, and the headline (hours, sessions).
- If `gitGuard.ok` is false: warn loudly that their personal stats are tracked by git, and show `gitGuard.fix`. Don't run it for them.
- Relay any `warnings` briefly.
- If `headline.sessions` is 0: say there's nothing to recap for that period yet (and suggest another month), then stop.
- `--github` is the ONLY part of rewynd that uses the network (read-only, through the user's own `gh` login). If `github.ok` is false, say why (`github.reason`) and carry on without it.

### 3. Ask before reading their messages
Ask: **"rewynd will read about 150 of your own messages (secrets and emails removed) to write the funny parts of your story. OK?"**
- Yes → read `OUT/samples.json` in step 4.
- No → write the story from the numbers only (no `samples.json`). Set `hardestBug` to `null`.

### 4. Write `OUT/story.json`
Read `OUT/stats.json` (and `OUT/samples.json` if allowed). Never open the agents' raw logs.

Write exactly this shape (`contract/recap.ts` → `Story` is the source of truth):

```json
{
  "schemaVersion": 1,
  "personality": { "id": "3am-shipper", "title": "The 3AM Shipper", "line": "46 sessions after midnight. Sleep is a suggestion." },
  "captions": {
    "intro": "Your October in AI coding",
    "hours": "That's a part-time job you didn't apply for",
    "mainAI": "You cheated on Claude Code with Codex 20 times",
    "heatmap": "22 days in a row. Touch grass?",
    "peakHour": "Peak focus: 2AM",
    "projects": "lumen ate most of your month",
    "tools": "Mostly running commands",
    "shipped": "Most of your commits had an AI co-author"
  },
  "projects": [{ "name": "lumen", "line": "Mostly fighting auth" }],
  "hardestBug": { "project": "lumen", "line": "A login loop that took 40 messages to kill" },
  "funnyLines": ["You said \"why\" 125 times."],
  "backgroundLine": "Codex double-checked itself 236 times.",
  "closing": "See you next month."
}
```

Rules (the script checks them in step 5):
- **Only use numbers that exist in `stats.json`.** Never invent or estimate. For hours, use whole hours rounded **down** (`floor(totals.activeMinutes / 60)`, e.g. 5,172 minutes → "86 hours"), which is what the video shows.
- **personality.id** must be one of: `3am-shipper, rewriter, polite-one, speedrunner, bug-whisperer, architect, juggler, marathoner, weekend-warrior`. Usually take `personalityHints[0]`. Pick from the top 3 only if the samples clearly fit another one better. `title` = the standard title for that id.
- Keep text short. Captions ≤ 70 characters, `personality.line` ≤ 110, funny lines ≤ 90. Each one should read in about 2 seconds.
- **Tone:** a playful roast, never mean. No swearing at the user.
- **Never** quote anything that looks like a secret, a private person's name, an email, or client details. Paraphrase.
- `projects`: up to 3, using names from `stats.projects`.
- `hardestBug`: from `samples.json → bugCandidates` (the one with the most bug messages). Say what the bug was about in one line. Use `null` if there are no candidates or no consent.
- `funnyLines`: 1–3 lines built from `phrases`, `time.lateNightSessions`, `agentSwitches`, `longestSession`, `shipped`...
- `backgroundLine`: if `backgroundRuns.total > 0`, one joke built from its real counts (e.g. Codex `review` → "Codex double-checked itself N times"; `subagent` → "Your agents spun up N little helpers"). Otherwise `null`.
- `mainAI` caption only matters with 2+ agents. Prefer `agentSwitches.topSwitch` ("You cheated on X with Y N times").
- Leave out captions you have nothing good for. The video has defaults. (The `personality` and `outro` scenes don't use captions: they show `personality` and `closing`.)
- The story only sees messages still on disk (`samples.json → onDisk`), but the numbers cover the whole period. Don't claim things about weeks you didn't see.

### 5. Check the story
Run `story-check`. If `ok` is false, fix every listed error in `story.json` and run it again (at most 3 rounds). Mention any `warnings` only if they matter.

### 6. Design choices
Run `prefs`.
- If `prefs.design` is `null` (first time), ask these questions in **one** prompt (multiple-choice where the tool allows it):
  1. **Theme**: "Auto (matches your personality)" plus each theme from the `themes` command (`label`, `description`).
  2. **Font**: Inter (default) or "My own font" (ask for the path to a .ttf / .otf / .woff2 file on their machine).
  3. **Format**: Vertical 9:16 (TikTok / Reels / Stories, default) · Wide 16:9 (X / YouTube) · Both.
  4. **Show project names?** Ask only if `stats.projects` isn't empty: "Yes" or "Hide them (Project A / B / C)". Project names can give away client work.
  Save with: `prefs --set '{"design":{"theme":"auto","font":{"kind":"inter"},"format":"vertical","hideProjectNames":false,"musicFile":null}}'`
- If preferences exist, ask one question: "Use the same look as last time (theme X, format Y)?" and only re-ask what they want to change.
- Music: none by default. Only if the user offers their own audio file, set `"musicFile": "/abs/path"`. rewynd never ships music.

### 7. Render (zero tokens)
Run `render` (add `--format wide|both` only if they want to override the saved format just this once).
- The **first** render installs the video template's dependencies and a headless browser (one-time download, about 1–2 minutes). Say so before you start. After that it works offline.
- If the result has `storyErrors`, go back to step 5.
- Report the file path(s) from `files`. On macOS offer to open it (`open "<file>"`).

### 8. Wrap up (2 lines)
- Where the video is, and that it's made to post (the footer links back to rewynd).
- Remind them: **run `/rewynd` (or `/rewynd-status`) at least once every 30 days** so no day is lost. Claude Code deletes transcripts after 30 days by default, and rewynd never changes that setting. It just keeps its own daily totals.

## Never
- Never change any agent's settings or files (including `cleanupPeriodDays`). Read-only, always.
- Never send raw logs anywhere, never paste message samples into the chat, never upload anything. The only network use is `--github`, and only when asked.
- Never write Remotion code. The video template is fixed and only receives props.
