// =============================================================================
// story/validate-story.ts — check output/story.json before it goes into a video.
//
// Claude writes story.json (captions, personality, funny lines). Before we
// render, a script checks it, because a video is shared publicly and wrong
// numbers are embarrassing:
//   • shape: every required field, a valid personality id
//   • length: captions short enough to read in ~2 seconds
//   • honesty: every number in the text must exist in stats.json (in some
//     natural form: 1,234 / 81% / 3AM / 33 hours...). Invented numbers fail.
//     The hardest-bug line may also use its session's counts from samples.json.
// Errors are returned as plain sentences so the skill can fix and retry.
// =============================================================================

import { PERSONALITIES, SCENE_ORDER, type Stats, type Story } from "../../contract/recap.ts";

export type StoryCheck = { ok: boolean; errors: string[]; warnings: string[] };

const LIMITS = { caption: 70, personalityLine: 110, funnyLine: 90, projectLine: 80, closing: 90, bugLine: 110 };

/**
 * `bugNumbers`: the counts in samples.json → bugCandidates ("took 47 messages
 * to kill"). Allowed in hardestBug.line only, since that's where they belong.
 */
export function validateStory(story: any, stats: Stats, bugNumbers: number[] = []): StoryCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

  if (!story || typeof story !== "object") return { ok: false, errors: ["story.json is not a JSON object"], warnings };
  if (story.schemaVersion !== 1) errors.push("schemaVersion must be 1");

  // --- personality ---
  if (!story.personality || !(story.personality.id in PERSONALITIES)) {
    errors.push(`personality.id must be one of: ${Object.keys(PERSONALITIES).join(", ")}`);
  }
  if (!isStr(story.personality?.title)) errors.push("personality.title is required");
  if (!isStr(story.personality?.line)) errors.push("personality.line is required");

  // --- captions ---
  const captions = story.captions ?? {};
  if (typeof captions !== "object") errors.push("captions must be an object keyed by scene id");
  for (const [scene, text] of Object.entries(captions)) {
    if (!SCENE_ORDER.includes(scene as any)) errors.push(`captions.${scene}: unknown scene (use ${SCENE_ORDER.join(", ")})`);
    if (!isStr(text)) errors.push(`captions.${scene} must be a non-empty string`);
  }

  // --- lists ---
  if (!Array.isArray(story.projects)) errors.push("projects must be an array (can be empty)");
  if (!Array.isArray(story.funnyLines)) errors.push("funnyLines must be an array of 1–3 strings");
  else if (story.funnyLines.length > 3) errors.push("funnyLines: at most 3");
  if (story.hardestBug !== null && story.hardestBug !== undefined && !isStr(story.hardestBug?.line)) {
    errors.push("hardestBug must be null or { project, line }");
  }
  if (story.backgroundLine !== null && story.backgroundLine !== undefined && !isStr(story.backgroundLine)) {
    errors.push("backgroundLine must be null or a string");
  }
  if (!isStr(story.closing)) errors.push("closing is required");

  // --- lengths ---
  const texts: { where: string; text: string; max: number }[] = [];
  for (const [scene, text] of Object.entries(captions)) if (isStr(text)) texts.push({ where: `captions.${scene}`, text, max: LIMITS.caption });
  if (isStr(story.personality?.line)) texts.push({ where: "personality.line", text: story.personality.line, max: LIMITS.personalityLine });
  (Array.isArray(story.funnyLines) ? story.funnyLines : []).forEach((t: unknown, i: number) => isStr(t) && texts.push({ where: `funnyLines[${i}]`, text: t, max: LIMITS.funnyLine }));
  (Array.isArray(story.projects) ? story.projects : []).forEach((p: any, i: number) => isStr(p?.line) && texts.push({ where: `projects[${i}].line`, text: p.line, max: LIMITS.projectLine }));
  if (isStr(story.hardestBug?.line)) texts.push({ where: "hardestBug.line", text: story.hardestBug.line, max: LIMITS.bugLine });
  if (isStr(story.backgroundLine)) texts.push({ where: "backgroundLine", text: story.backgroundLine, max: LIMITS.funnyLine });
  if (isStr(story.closing)) texts.push({ where: "closing", text: story.closing, max: LIMITS.closing });
  for (const t of texts) {
    if (t.text.length > t.max) errors.push(`${t.where} is ${t.text.length} characters; keep it under ${t.max} so it reads in ~2 seconds`);
  }

  // --- honesty: numbers must come from stats.json ---
  const known = knownNumbers(stats);
  const bugKnown = new Set([...known, ...bugNumbers]);
  for (const t of texts) {
    const ok = t.where === "hardestBug.line" ? bugKnown : known;
    for (const n of numbersIn(t.text)) {
      if (!ok.has(n)) errors.push(`${t.where}: the number ${n} isn't in stats.json${ok === bugKnown ? " or the bug candidates in samples.json" : ""}. Use only real numbers`);
    }
  }

  // --- secrets slipped through? ---
  for (const t of texts) {
    if (/\[REDACTED\]|\[email\]|sk-|ghp_|@[a-z0-9-]+\.[a-z]{2,}/i.test(t.text)) {
      errors.push(`${t.where} contains something that looks like a secret or email; remove it`);
    }
  }

  // --- project names exist ---
  const names = new Set([...stats.projects.map((p) => p.name), ...(stats.shipped?.byRepo.map((r) => r.name) ?? [])]);
  (Array.isArray(story.projects) ? story.projects : []).forEach((p: any, i: number) => {
    if (!names.has(p?.name)) warnings.push(`projects[${i}].name "${p?.name}" isn't one of the top projects in stats.json`);
  });

  return { ok: errors.length === 0, errors, warnings };
}

/** The numbers validateStory accepts in hardestBug.line, from a parsed samples.json (or null). */
export function bugNumbersFrom(samples: any): number[] {
  const list = Array.isArray(samples?.bugCandidates) ? samples.bugCandidates : [];
  return list.flatMap((b: any) => [b?.bugMessages, b?.userMessages]).filter((n: unknown): n is number => typeof n === "number");
}

/** Numbers written in a text: "1,234" → 1234, "81%" → 81, "3AM" → 3, "33.5" → 33.5. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\w.]*\d)/g)) {
    out.push(Number(m[1].replace(/,/g, "")));
  }
  return out;
}

/**
 * Every number a caption may honestly use: all numeric values in stats.json
 * plus their natural rewrites (minutes → hours, 0.81 → 81%, 2026-10-21 → 21,
 * hour 2 → "2AM" / 14 → "2PM", tokens in millions...). Small counting words
 * (0–12) are always allowed ("top 5", "2 agents", "1 more thing").
 */
export function knownNumbers(stats: Stats): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i <= 12; i++) set.add(i);
  set.add(100);
  const addNum = (n: number) => {
    if (!Number.isFinite(n)) return;
    set.add(n);
    set.add(Math.round(n));
    set.add(Math.round(n * 10) / 10);
    if (n > 0 && n <= 1) set.add(Math.round(n * 100)); // shares → percent
    if (n >= 60) {
      set.add(Math.round(n / 60)); // minutes → hours
      set.add(Math.round((n / 60) * 10) / 10);
      set.add(Math.floor(n / 60));
      set.add(Math.round(n / 1440)); // minutes → days
      set.add(Math.round((n / 1440) * 10) / 10);
    }
    if (n >= 1000) {
      for (const div of [1e3, 1e6, 1e9]) {
        set.add(Math.round(n / div));
        set.add(Math.round((n / div) * 10) / 10);
      }
    }
  };
  const walk = (v: unknown) => {
    if (typeof v === "number") addNum(v);
    else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-").map(Number);
      set.add(y);
      set.add(m);
      set.add(d);
      set.add(Number(String(y).slice(2)));
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(stats);
  if (stats.time.busiestHour !== null) {
    const h = stats.time.busiestHour;
    set.add(h % 12 === 0 ? 12 : h % 12); // 14 → "2PM", 0 → "12AM"
  }
  // Sums people naturally write: e.g. please + thanks.
  set.add(stats.phrases.please + stats.phrases.thanks);
  set.add(stats.phrases.fixIt + stats.phrases.stillBroken);
  return set;
}
