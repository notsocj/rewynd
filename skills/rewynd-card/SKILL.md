---
name: rewynd-card
description: Make a single shareable rewynd image (one card summarizing the user's month or year of AI coding) instead of the full video. 100% local. Use when the user wants a quick rewynd card, screenshot, or image recap.
argument-hint: "[YYYY-MM | --year YYYY] [--github]"
---

# /rewynd-card — one image instead of a video

Same as `/rewynd`, but it renders a single summary image (personality, hours, top project, top tool, busiest hour), for people without time for a video.

Follow the **`rewynd` skill exactly** (it's in the sibling folder `../rewynd/SKILL.md`; read it if it isn't already loaded) for:
- **Paths** (REWYND, DATA, OUT, and the `node … cli.ts <command> --data-dir "DATA"` pattern)
- **Steps 1–6**: period → `collect` → consent → write `story.json` → `story-check` → design choices

Then, instead of step 7, run:

`render --card` (add `--format wide|both` only to override the saved format once)

Report the PNG path(s) from `files` and offer to open them. Finish with the same 30-day reminder as `/rewynd`.

The first render installs the template's dependencies (one-time download, about 1–2 minutes). Say so before starting.
