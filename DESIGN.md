# rewynd — Design System

The look is **"tape rewind meets terminal"**: your month (or year) of AI coding, played back like a home-video tape, with the stats printed like output from a command you just ran.

It builds on the name: rewynd = rewind. Camcorder and VCR details (REC dot, tape counter, scan lines, transport buttons, tape labels, date stamps) mix with code details (terminal windows, typed commands, a blinking cursor, +green / −red diff colors).

We keep the parts of the "year in review" format that work: **one stat per card, huge numbers, bold color fields, and a personality reveal**. Spotify Wrapped was only ever a reference for that rhythm. We use none of its shapes, logos, wordmark or URLs. Agent names (Claude, Codex, Cursor…) are shown as plain text, never as their logos.

(v1 was a Wrapped-style draft. Its stills are kept in `output/samples/v1-wrapped/` for comparison.)

---

## 1. Typography — Inter only

One typeface everywhere: **Inter** (v4, SIL OFL), installed from npm (`@fontsource-variable/inter`), so it ships in the repo and rendering never makes a network call. Inter's **Display** optical size kicks in automatically at large sizes, which tightens the giant numbers.

**Numbers are always tabular** (`font-variant-numeric: tabular-nums`): every digit is the same width. That gives counters and stats the even rhythm of a tape counter or terminal output, and stops count-ups from wobbling, without adding a monospace font.

| Role | Weight | Size @1080×1920 | Tracking | Notes |
|---|---|---|---|---|
| Hero number (`86`) | Black 900 | sized to fill ~70% of the width, max 430px | -0.05em | Tabular. Followed by a unit ("hrs") and a blinking cursor |
| Tape label title (`OCTOBER '26`) | Black 900 | 104px | -0.03em | On the paper label |
| Tape label subtitle (`TAPE 01 · HOURS WITH AI`) | ExtraBold 800 | 28px | 0.12em, caps | 65% opacity |
| OSD (`REC`, tape counter) | ExtraBold 800 | 44px | 0.04em | Tabular |
| Typed command (`$ rewynd hours --month`) | Bold 700 | 36–42px | 0 | `$` in diff green |
| List item ("Edit files") | Black 900 | 60px | -0.03em | Inside the terminal |
| Personality name | Black 900 | 112px | -0.05em | |
| Caption | Medium 500 | 44–52px | 0 | Key words in Black |
| Footer | ExtraBold 800 / SemiBold 600 | 34 / 30px | 0 | "made with rewynd" + repo URL |

Rules:
- **Black** for what you read first, **Medium** for everything else, **ExtraBold** for machine text (OSD, stamps, buttons).
- Never more than ~6 words of caption per card. Each card has to read in about 2 seconds.

**Trade-off to watch:** terminal text (the typed command, the "> ship it" badge) is set in Inter, not a monospace font. It reads fine because the numbers are tabular, but it's less "real terminal". If it ever feels wrong, the fix is an OFL mono (e.g. JetBrains Mono) for command lines only. Not added, to keep one font.

(Satoshi and Poppins were tried and dropped: Satoshi's license forbids putting it in a public repo, and one font keeps the cards consistent. People who want another font can still use their own file, see §8.)

---

## 2. Color

Four themes ("color fields"), listed in `video/src/themes.json` (what the user picks from) with their colors in `video/src/theme.ts`. Each theme has **one accent** for its hero numbers.

| Token | Hex | Use |
|---|---|---|
| `tape` | `#131313` | Night background, terminal windows |
| `paper` | `#EFEEE9` | Text on Night, tape label stickers |
| `white` | `#FFFFFF` | Text on Blue screen |
| `blue` | `#1D3DF2` | Blue-screen background (the VCR "no signal" blue, brighter) |
| `rec` | `#FF3B30` | REC dot, REC button |
| `add` | `#3DDC84` | Diff green: lines added, level meters, `$` prompt |
| `del` | `#FF5C57` | Diff red: lines removed |
| `amber` | `#FFB627` | Camcorder date stamp, "hot" end of level meters |
| `lilac` | `#A5A0FF` | Night-sky accent (the 3AM Shipper) |

| Theme id | Label | Background / text | Accent |
|---|---|---|---|
| `night` (**default**) | Night | `tape` / `paper`, faint light scan lines | green (`add`) |
| `bluescreen` | Blue screen | `blue` / `white` with a hard 4px drop shadow (real VCR menu text) | amber |
| `midnight` | Midnight | `tape` / `paper` | lilac |
| `label` | Tape label | `paper` / `tape` (the light option); stickers get an outline | red (`rec`) |

`"auto"` picks a theme from the personality (`personalityThemes` in themes.json): 3AM Shipper → midnight · Rewriter, Speedrunner, Juggler → bluescreen · Polite One, Architect, Weekend Warrior → label · Bug Whisperer, Marathoner → night.

Rules:
- Red text never sits directly on the blue (red on blue shimmers). Red only appears on dark surfaces: the terminal window, the REC dot.
- The terminal window is always dark (`tape`/near-black) on every theme, so the diff colors and meters read the same everywhere. Text inside it always uses the panel colors.
- Accent colors are for large text only (hero numbers, the busiest-day marker). Captions use `fg` or `dim`.

---

## 3. Tape elements (camcorder / VCR)

All drawn in code (SVG / CSS). No image files, so they stay sharp and animate.

| Element | Where | What it does |
|---|---|---|
| **OSD bar** | Top of every card | `● REC` on the left (dot blinks: 2/3 s on, 1/3 s off), `▶` tape counter on the right. The Hours card's counter rolls up with the big number to the real total (`086:12:xx`); other cards show a running timecode |
| **Tape label** | Top of stat cards | Paper sticker with three colored bands (rec / amber / add), a caps subtitle (`TAPE 02 · TOP TOOLS`), the title (`OCTOBER '26`) and one ruled line. Sits at -1.5°, hard shadow. Drops in and settles |
| **Tape timeline** | Hours card | One bar per day of the month, height = hours that day. A red playhead sweeps day 1 → today and bars grow behind it. Future days are dashed "blank tape" stubs. Busiest day is in the accent color with `▲ OCT 21` under it |
| **Level meter** | Top tools rows | 24 LED-style segments, lit in proportion to the top tool. Last 15% lights amber (the "hot" zone). Lights up left → right |
| **Transport bar** | Above the footer on every card | `◀◀ REW` `▶ PLAY` `■ STOP` `● REC`. One button is pressed (filled): PLAY on stat cards, REC on the personality card, REW during the rewind glitch |
| **Viewfinder** | Personality card | Four corner brackets, a battery icon, and an amber burned-in date stamp (`AM 3:07` · `OCT 21 2026`) |
| **Scan lines** | Over everything | 2px line every 6px at very low opacity, a soft tracking band rolling down every 5 s, a light CRT vignette. Kept subtle: heavy lines turn into moiré after social apps re-compress the video |

## 4. Code elements (terminal)

| Element | Where | What it does |
|---|---|---|
| **Typed command** | Above the hero / inside the terminal | `$ rewynd hours --month` types itself out (~1.5 chars per frame) with a cursor riding the end |
| **Terminal window** | Top tools card | Dark window, three dots (rec / amber / add), title `~/rewynd — zsh`, hard shadow. Pops open with a small scale-up |
| **Blinking cursor** | After the hero number, end of commands | Block cursor, 0.5 s on / 0.5 s off |
| **Diff line** | Last line of the terminal output | `+18,204 −6,931 lines changed` in green / red |
| **Personality badges** | Personality card | Enamel-pin SVGs; the 3AM Shipper's has a moon, twinkling stars and a mini terminal saying `> ship it` |

Tool names are **agent-neutral**: "Edit files", "Run commands", "Read files", "Search", "Write files". Never one agent's internal names (Claude Code's `Edit`/`Bash`/`Grep`), because the recap merges several agents.

---

## 5. Layout

Two sizes: **vertical 1080×1920** (TikTok / Reels / Stories) and **wide 1920×1080** (X / YouTube). Every scene works in both.

- **Chrome** (`tape/layout.ts`): vertical keeps 96px sides, the OSD at y=150, content between y≈290 and y=1520, the transport bar above the footer, and the footer 200px from the bottom (clear of the apps' own buttons). Wide puts the OSD at the top and the footer + a compact transport bar on one bottom row. Wide sizes are scaled by 0.74.
- **Stage** (`tape/Stage.tsx`): each scene gives a *primary* (the big thing) and an optional *secondary* (list, timeline, calendar). Vertical stacks them under the tape label; wide puts them side by side. Each slot tells its children its width, so hero numbers and meters size themselves.
- **FitBox** (`tape/FitBox.tsx`): if a column's content is taller than its space (very long captions, big custom fonts), it scales the column down to fit (never below 50%). Normal data fits at 100%.
- **Odd values never break layout**: names truncate with "…" (`ellipsis`), numbers never wrap, hero numbers size from their digit count (7-digit numbers shrink), long captions wrap, emoji render through the system emoji fonts, and empty data shows a line instead of an empty box ("(no tool calls recorded)", "Nothing reached main yet").
- **Hidden names**: with `hideProjectNames`, every project/repo name becomes "Project A/B/C" (in order of importance), in lists *and* inside Claude's free text (whole-name matches only).

Footer on every card: `◀◀ made with rewynd` and the repo URL (`props.repoUrl`, from `REPO_URL` in the contract), printed because screenshots lose links.

---

## 6. Motion

- 30fps. Each card is 4 s: ~0.6 s in, then holding.
- **Every scene starts with a rewind glitch** (9 frames, ~0.3 s): the picture tears into 7 strips shoved sideways, white noise lines flash, a big `◀◀` shows, REW is pressed, then it snaps to PLAY. Randomness uses Remotion's seeded `random()`, so every render is identical.
- Hero numbers **count up** over ~1 s with an ease-out and land with a small punch (1 → 1.04 → 1).
- Entrances use springs (`damping ≈ 11–15`, `mass ≈ 0.6–0.8`), not linear tweens.
- List rows print 4 frames apart, like command output.
- Something always moves during the hold (REC blink, cursor blink, tape counter, tracking band, twinkling stars) so a card never looks frozen.

---

## 7. The scenes

One component per `SceneId` (`video/src/scenes/`, durations in `scenes/registry.ts`). render.ts drops scenes with nothing to show; each scene still handles empty data on its own.

| Scene | s | Primary | Secondary | Pressed |
|---|---|---|---|---|
| `intro` | 3 | Big tape label, "Your October in AI coding", typed `$ rewynd --month october`, agents on this tape | — | PLAY |
| `hours` | 4 | `86 hrs` + cursor, caption, sessions · active days. Counter rolls to `086:12:xx` | Tape timeline (bars per day, red playhead, ▲ busiest day, dashed blank tape for unsaved days; weekly bars for a year) | PLAY |
| `mainAI` | 3.5 | `62%`, "Claude Code was your main AI", switch line ("You cheated on Claude Code with Codex 41 times") | Terminal: share per agent with meters | PLAY |
| `heatmap` | 4 | `22 days`, longest streak, gap days | Calendar (Mon–Sun) or GitHub-style year grid; unsaved days hatched "no tape" | PLAY |
| `peakHour` | 3.5 | "YOU PEAKED AT" `2AM`, late-night line | 24 LED columns, peak in accent | PLAY |
| `projects` | 4 | Top project name, caption | Terminal `ls`: time, sessions, agents, Claude's line as a `# comment` | PLAY |
| `tools` | 3.5 | `3,727 tool calls.` | Terminal: top 5 agent-neutral tools with meters | PLAY |
| `shipped` | 4 | `81%` of commits with AI, biggest ship day, GitHub line if any | Terminal `git log`: top repos + meters + `+lines −lines` | PLAY |
| `funny` | 4.5 | "Caught on tape." | Terminal "bloopers": funny lines, then the background-runs line as `[bg]` | PLAY |
| `hardestBug` | 3.5 | "The one that fought back." | Terminal `npm test`: red FAIL + project, the bug line, green PASS | PLAY |
| `personality` | 4.5 | Viewfinder with the personality's pin badge and a time/date stamp of the busiest hour/day | `// my coder personality`, title, line | REC |
| `outro` | 4.5 | Closing line, "Make your own tape → repo URL" | Grid: hours, sessions, main AI, peak hour, top project, top tool, AI commits, personality | STOP |

**Badges** (`scenes/badges/Badge.tsx`): one enamel-pin design for all nine personalities; each changes the sky color, the icon (moon, rewrite arrows, heart, lightning, bug, drafting triangle, juggling balls, stopwatch, sun) and the mini-terminal prompt (`> ship it`, `> rm -rf v1`, `> thanks!`, `> done.`, `> fixed?`, `> plan.md`, `> 5 tabs`, `> still here`, `> sat 10am`). Icons idle-animate.

### Compositions

| Id | What |
|---|---|
| `Rewynd` | The video. Plays `props.scenes` in order, each opening with the rewind glitch. Length = sum of scene durations; size from `prefs.format`. Adds `<Audio>` when `musicStaticPath` is set |
| `RewyndCard` | The share image: the outro, frozen on its last frame, same props and sizes |
| `Samples/Rewynd-wide`, `Samples/Scene-<id>`, `Samples/Scene-<id>-wide` | Previews with the October fixture (`fixtures/october.ts`) |
| `Samples/Rewynd-edge`, `Samples/Rewynd-edge-wide` | Stress tests (`fixtures/edge.ts`): a year with gaps, one agent, 7-digit numbers, long/emoji names, no tools, nothing shipped; the wide one uses the light theme with hidden names |
| `Dev/Compare` | Side-by-side stills for design reviews |

Render from `video/`:

```bash
npx remotion render src/index.ts Rewynd ../output/rewynd.mp4 --props=../output/props.json
```

```bash
npx remotion still src/index.ts RewyndCard ../output/card.png --props=../output/props.json
```

---

## 8. User design choices

The user picks the final look, not us. Everything above is the **default**. Before rendering, `/rewynd` asks a few quick questions, and the answers go into the pre-built Remotion template as props. Claude never writes new Remotion code for a choice. Every option is a prop the template already supports.

### What we ask

Four questions at most, so it fits in one Claude Code question prompt (`AskUserQuestion` takes up to 4). Every question has a recommended default, so just hitting enter still gives a good video.

| # | Question | Options | Default |
|---|---|---|---|
| 1 | **Theme** | The themes in `video/src/themes.json` (Night · Blue screen · Midnight · Tape label) or "Match my personality" (`auto`) | Match my personality |
| 2 | **Font** | Inter · My own font (path to a `.ttf`/`.otf`/`.woff2` on their machine) | Inter |
| 3 | **Hide project names?** | No · Yes ("Project A/B/C") | Ask when client work is likely |
| 4 | **Format** | Vertical 9:16 (TikTok/Reels/Stories) · Wide 16:9 (X/YouTube) · Both | Vertical |

"Match my personality" uses `personalityThemes` in themes.json (see §2).

Also: **Music** is none by default. The user can pass their own audio file. We never ship copyrighted music.

### "My own font"
This is how people get Satoshi or any other font we can't put in the repo. scripts/render.ts copies the file into `video/public/` for the render and passes its path as `customFontStaticPath`; nothing is uploaded anywhere. The video loads it with the browser's FontFace API (not `@remotion/fonts`' `loadFont()`, which would cancel the whole render on a bad file); if it fails to load, the video falls back to Inter.

### Saved choices
- Answers are saved to `data/preferences.json` inside the rewynd folder (git-ignored, kept across updates; see rewynd-context.md §19).
- Later runs show the saved choices and ask "Use the same look?" (yes/change) instead of all four questions again.
- `/rewynd-card` uses the same preferences.

### Props shape

The props are `RecapProps` from **`contract/recap.ts`** (shared with scripts/): `{ stats, story, prefs, scenes, repoUrl, customFontStaticPath, musicStaticPath }`, with `prefs: { theme, font, format, hideProjectNames, musicFile }`. `video/src/schema.ts` mirrors it in zod for Studio and checks at compile time that the two still match.

### What this means for the template
- Colors are never hardcoded in scenes. Scenes read the `Theme` for `prefs.theme` (with "auto" resolved from the personality) through `useRecap()`.
- Every scene is laid out through `Stage`, so it works in 9:16 and 16:9.
- Hero numbers are sized from their character count, so they fit with a custom font too.

---

## Open questions

- [ ] Is Inter enough for the terminal lines, or add an OFL mono just for commands (§1 trade-off)?
- [ ] Real repo once it exists: `REPO_URL` lives in `contract/recap.ts`.
