// =============================================================================
// story/validate-story.ts — check output/story.json before it goes into a video.
//
// Claude writes story.json (captions, personality, funny lines). Before we
// render, a script checks it, because a video is shared publicly and wrong
// numbers are embarrassing:
//   • shape: every required field, a valid personality id
//   • length: captions short enough to read in ~2 seconds
//   • honesty: when the words name a stat ("why" 88 times, 38 sessions after
//     midnight, 86 hours, 41 commits...), the number must be THAT stat, not
//     just any number that happens to be in stats.json. Other numbers must
//     exist somewhere in stats.json (in some natural form: 1,234 / 81% / 3AM /
//     33 hours...). Invented numbers fail. The hardest-bug line may also use
//     its session's counts from samples.json.
// Errors are returned as plain sentences so the skill can fix and retry.
// =============================================================================

import { AGENT_LABELS, PERSONALITIES, SCENE_ORDER, type AgentId, type Stats, type Story } from "../../contract/recap.ts";

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
  // `project`: the project a line is about, so "30 hours" there means that project's hours.
  const texts: { where: string; text: string; max: number; project?: string }[] = [];
  for (const [scene, text] of Object.entries(captions)) if (isStr(text)) texts.push({ where: `captions.${scene}`, text, max: LIMITS.caption });
  if (isStr(story.personality?.line)) texts.push({ where: "personality.line", text: story.personality.line, max: LIMITS.personalityLine });
  (Array.isArray(story.funnyLines) ? story.funnyLines : []).forEach((t: unknown, i: number) => isStr(t) && texts.push({ where: `funnyLines[${i}]`, text: t, max: LIMITS.funnyLine }));
  (Array.isArray(story.projects) ? story.projects : []).forEach((p: any, i: number) => isStr(p?.line) && texts.push({ where: `projects[${i}].line`, text: p.line, max: LIMITS.projectLine, project: p?.name }));
  if (isStr(story.hardestBug?.line)) texts.push({ where: "hardestBug.line", text: story.hardestBug.line, max: LIMITS.bugLine, project: story.hardestBug.project ?? undefined });
  if (isStr(story.backgroundLine)) texts.push({ where: "backgroundLine", text: story.backgroundLine, max: LIMITS.funnyLine });
  if (isStr(story.closing)) texts.push({ where: "closing", text: story.closing, max: LIMITS.closing });
  for (const t of texts) {
    if (t.text.length > t.max) errors.push(`${t.where} is ${t.text.length} characters; keep it under ${t.max} so it reads in ~2 seconds`);
  }

  // --- honesty: numbers must come from stats.json ---
  const known = knownNumbers(stats);
  const bugKnown = new Set([...known, ...bugNumbers]);
  const claims = statClaims(stats);
  for (const t of texts) {
    const ok = t.where === "hardestBug.line" ? bugKnown : known;
    for (const span of numberSpans(t.text)) {
      const n = span.value;
      const claim = claimFor(t.text, span, claims, t.project);
      if (claim) {
        if (!claim.values.some((v) => v.n === n)) errors.push(`${t.where}: ${claimError(claim, n)}. Use the real number${claim.near ? "" : ". If it counts something else, say what (\"longest session\", \"busiest day\", a project or agent name)"}`);
      } else if (!ok.has(n)) {
        errors.push(`${t.where}: the number ${n} isn't in stats.json${ok === bugKnown ? " or the bug candidates in samples.json" : ""}. Use only real numbers`);
      }
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
  return numberSpans(text).map((m) => m.value);
}

type NumberSpan = { value: number; start: number; end: number };

function numberSpans(text: string): NumberSpan[] {
  return [...text.matchAll(/(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\w.]*\d)/g)].map((m) => ({
    value: Number(m[1].replace(/,/g, "")),
    start: m.index,
    end: m.index + m[1].length,
  }));
}

// ---------------------------------------------------------------------------
// Stat claims: wording that names one specific stat.
// ---------------------------------------------------------------------------
// "You asked 'why' 125 times" must match phrases.why, even if 125 happens to be
// some other stat. A claim applies when the words right after the number fit
// its unit ("times", "sessions", "hours", "%"...) and, for keyword claims, its
// keyword is in the same clause. The nearest keyword wins; claims without a
// keyword ("86 hours", "300 sessions") only apply when no keyword claim does.

type Claim = {
  /** "\"why\" count", "total active hours"... */
  label: string;
  /** Keyword that must appear in the same clause; null = the unit alone decides. */
  near: RegExp | null;
  /** What must follow the number. */
  unit: RegExp;
  values: { n: number; from: string }[];
  /** A line about this project counts as naming it. */
  project?: string;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const kw = (source: string) => new RegExp(source, "gi");
const nameKw = (names: string[]) => kw(names.map((n) => `(?<![\\w])${escapeRe(n)}(?![\\w])`).join("|"));

/** The number is followed (up to 2 words later) by one of `words`: "45 little helpers". */
const unitOf = (words: string) => new RegExp(`^[\\s-]*(?:[\\w'-]+\\s+){0,2}(?:${words})\\b`, "i");
/** A count: "88 times", "88x", "88 whys", or the number ends the clause ("why: 88"). */
const countOf = (words: string) =>
  new RegExp(`^(?:[\\s-]*(?:[\\w'-]+\\s+){0,2}(?:times?|x|${words})\\b|\\s*×|\\s*[^\\w\\s%:-]|\\s*$)`, "i");
const HOURS = unitOf("hours?|hrs?|h");
const SESSIONS = unitOf("sessions?");
const COMMITS = unitOf("commits?");
const PERCENT = /^\s*(?:%|percent\b)/i;

/** Whole hours rounded down / to the nearest, and to 1 decimal. */
function hoursOf(minutes: number, from: string, nearest = true): Claim["values"] {
  const out = [{ n: Math.floor(minutes / 60), from }, { n: Math.round(minutes / 6) / 10, from }];
  if (nearest) out.push({ n: Math.round(minutes / 60), from });
  return out;
}

function statClaims(stats: Stats): Claim[] {
  const claims: Claim[] = [];
  const add = (c: Claim) => {
    c.values = c.values.filter((v) => Number.isFinite(v.n));
    if (c.values.length) claims.push(c);
  };
  const p = stats.phrases;

  // --- phrases (pairs first: "please and thanks 43 times" may be the sum) ---
  const PLEASE = "please", THANKS = "thank(?:s| you)", FIX = "fix(?:ed)? it", BROKEN = "still broken", WHY = "whys?", SORRY = "sorry|sorries|apologi[sz]e[ds]?";
  add({ label: '"please" + "thanks" count', near: kw(`\\b(?:${PLEASE})\\b[^]*?\\b(?:${THANKS})\\b|\\b(?:${THANKS})\\b[^]*?\\b(?:${PLEASE})\\b`), unit: countOf(`${PLEASE}|${THANKS}`),
    values: [{ n: p.please + p.thanks, from: "phrases.please + phrases.thanks" }, { n: p.please, from: "phrases.please" }, { n: p.thanks, from: "phrases.thanks" }] });
  add({ label: '"fix it" + "still broken" count', near: kw(`\\b(?:${FIX})\\b[^]*?\\b${BROKEN}\\b|\\b${BROKEN}\\b[^]*?\\b(?:${FIX})\\b`), unit: countOf(`${FIX}|${BROKEN}`),
    values: [{ n: p.fixIt + p.stillBroken, from: "phrases.fixIt + phrases.stillBroken" }, { n: p.fixIt, from: "phrases.fixIt" }, { n: p.stillBroken, from: "phrases.stillBroken" }] });
  for (const [label, words, n, from] of [
    ['"why"', WHY, p.why, "phrases.why"],
    ['"please"', PLEASE, p.please, "phrases.please"],
    ['"thanks"', THANKS, p.thanks, "phrases.thanks"],
    ['"fix it"', FIX, p.fixIt, "phrases.fixIt"],
    ['"still broken"', BROKEN, p.stillBroken, "phrases.stillBroken"],
    ['"sorry"', SORRY, p.sorry, "phrases.sorry"],
  ] as const) {
    add({ label: `${label} count`, near: kw(`\\b(?:${words})\\b`), unit: countOf(words), values: [{ n, from }] });
  }

  // --- late nights, agent switches, background runs ---
  add({ label: "late-night session count", near: kw("midnight|late[- ]?nights?|before (?:dawn|sunrise)|after dark|wee hours|small hours"),
    unit: countOf("sessions?|nights?"), values: [{ n: stats.time.lateNightSessions, from: "time.lateNightSessions" }] });
  const sw = stats.agentSwitches;
  add({ label: "agent switch count", near: kw("cheat|switch|swapp?(?:ed|ing)?\\b|hopp?(?:ed|ing)\\b|two-?tim"), unit: countOf("days?|switch(?:es)?|swaps?"),
    values: [
      ...(sw.topSwitch ? [{ n: sw.topSwitch.count, from: "agentSwitches.topSwitch.count" }] : []),
      { n: sw.sameDay, from: "agentSwitches.sameDay" },
      { n: sw.sameProject, from: "agentSwitches.sameProject" },
    ] });
  const bg = Object.entries(stats.backgroundRuns.byAgent);
  const bgValues = (key: "review" | "subagent") => {
    const each = bg.map(([a, c]) => ({ n: c?.[key] ?? 0, from: `backgroundRuns.byAgent.${a}.${key}` })).filter((v) => v.n > 0);
    const total = { n: each.reduce((sum, v) => sum + v.n, 0), from: `all backgroundRuns ${key} counts` };
    return each.length === 1 ? each : [total, ...each];
  };
  add({ label: "background review count", near: kw("double[- ]?check|review|second opinion|check(?:ed|ing)? (?:itself|its own|your)"), unit: countOf("reviews?|checks?"), values: bgValues("review") });
  add({ label: "sub-agent (helper) count", near: kw("helpers?|sub-?agents?|minions?|clones?"), unit: countOf("helpers?|sub-?agents?|agents?|minions?|clones?"), values: bgValues("subagent") });

  // --- named scopes: a project, an agent, the longest session, the busiest day, last period ---
  if (stats.longestSession) {
    add({ label: "longest session (hours)", near: kw("longest|marathon|sitting|straight|\\bsession\\b"), unit: HOURS, values: hoursOf(stats.longestSession.minutes, "longestSession.minutes") });
  }
  const BUSIEST = kw("busiest|biggest|best day|\\bday\\b");
  if (stats.time.busiestDay) add({ label: "busiest day (hours)", near: BUSIEST, unit: HOURS, values: hoursOf(stats.time.busiestDay.minutes, "time.busiestDay.minutes") });
  for (const proj of stats.projects) {
    const near = nameKw([proj.name]);
    add({ label: `${proj.name} hours`, near, unit: HOURS, values: hoursOf(proj.minutes, `projects[${proj.name}].minutes`), project: proj.name });
    add({ label: `${proj.name} sessions`, near, unit: SESSIONS, values: [{ n: proj.sessions, from: `projects[${proj.name}].sessions` }], project: proj.name });
  }
  for (const [id, t] of Object.entries(stats.byAgent) as [AgentId, NonNullable<Stats["byAgent"][AgentId]>][]) {
    const label = AGENT_LABELS[id] ?? id;
    const near = nameKw([label, label.split(" ")[0]]);
    add({ label: `${label} hours`, near, unit: HOURS, values: hoursOf(t.activeMinutes, `byAgent.${id}.activeMinutes`) });
    add({ label: `${label} sessions`, near, unit: SESSIONS, values: [{ n: t.sessions, from: `byAgent.${id}.sessions` }] });
  }
  const prev = stats.previous;
  if (prev) {
    const near = kw(`last (?:month|year)|previous|${[prev.label, prev.label.split(" ")[0], prev.shortLabel].map((s) => `(?<![\\w])${escapeRe(s)}(?![\\w])`).join("|")}`);
    add({ label: `${prev.label} hours`, near, unit: HOURS, values: hoursOf(prev.activeMinutes, "previous.activeMinutes") });
    add({ label: `${prev.label} sessions`, near, unit: SESSIONS, values: [{ n: prev.sessions, from: "previous.sessions" }] });
    add({ label: `change vs ${prev.label} (%)`, near, unit: PERCENT, values: [{ n: prev.changePct, from: "previous.changePct" }, { n: Math.abs(prev.changePct), from: "previous.changePct" }] });
  }
  const sh = stats.shipped;
  if (sh) {
    for (const r of sh.byRepo) {
      add({ label: `${r.name} commits`, near: nameKw([r.name]), unit: COMMITS, values: [{ n: r.commits, from: `shipped.byRepo[${r.name}].commits` }, { n: r.aiCommits, from: `shipped.byRepo[${r.name}].aiCommits` }], project: r.name });
    }
    if (sh.biggestDay) add({ label: "biggest day commits", near: BUSIEST, unit: COMMITS, values: [{ n: sh.biggestDay.commits, from: "shipped.biggestDay.commits" }] });
    add({ label: "AI share of commits (%)", near: kw("commits?|co-?author|shipped|%\\s*AI\\b|percent AI\\b"), unit: PERCENT,
      values: [{ n: Math.round(sh.aiShare * 100), from: "shipped.aiShare" }, { n: Math.round(sh.aiShare * 1000) / 10, from: "shipped.aiShare" }] });
  }

  // --- totals: the unit alone ("86 hours", "300 sessions", "641 commits") ---
  const tot = stats.totals;
  add({ label: "total active hours", near: null, unit: HOURS,
    values: [...hoursOf(tot.activeMinutes, "floor(totals.activeMinutes / 60)", false), { n: Math.round(tot.activeHours * 10) / 10, from: "totals.activeHours" }] });
  add({ label: "total session count", near: null, unit: SESSIONS, values: [{ n: tot.sessions, from: "totals.sessions" }] });
  if (sh) {
    add({ label: "shipped commit count", near: null, unit: COMMITS,
      values: [
        { n: sh.commits, from: "shipped.commits" },
        { n: sh.aiCommits, from: "shipped.aiCommits" },
        ...Object.entries(sh.aiCommitsByAgent).map(([a, n]) => ({ n, from: `shipped.aiCommitsByAgent.${a}` })),
      ] });
  }
  return claims;
}

/** The clause around a number: sentence pieces split at . ! ? ; , and dashes. */
function clauseAround(text: string, span: NumberSpan): { start: number; end: number } {
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(/[.!?;,]\s+|\s+[—–-]\s+|\n/g)) {
    const s = m.index;
    const e = s + m[0].length;
    if (e <= span.start) start = e;
    else if (s >= span.end) {
      end = s;
      break;
    }
  }
  return { start, end };
}

/** Which stat this number claims to be, or null (then it only has to exist somewhere in stats.json). */
function claimFor(text: string, span: NumberSpan, claims: Claim[], project?: string): Claim | null {
  if (/['’]$/.test(text.slice(0, span.start))) return null; // a year: OCTOBER '26
  const clause = clauseAround(text, span);
  const body = text.slice(clause.start, clause.end);
  const after = text.slice(span.end, clause.end);
  let best: Claim | null = null;
  let bestDistance = Infinity;
  let unitOnly: Claim | null = null;
  for (const c of claims) {
    if (!c.unit.test(after)) continue;
    if (!c.near) {
      unitOnly ??= c;
      continue;
    }
    let distance = c.project !== undefined && c.project === project ? 1000 : Infinity;
    for (const m of body.matchAll(c.near)) {
      const s = clause.start + m.index;
      const e = s + m[0].length;
      distance = Math.min(distance, e <= span.start ? span.start - e : s >= span.end ? s - span.end : 0);
    }
    if (distance < bestDistance) {
      best = c;
      bestDistance = distance;
    }
  }
  return best ?? unitOnly;
}

/** '"why" count is 29, not 125 (phrases.why)': every value the claim accepts, with where it comes from. */
function claimError(c: Claim, n: number): string {
  const byValue = new Map<number, string[]>();
  for (const v of c.values) {
    const from = byValue.get(v.n) ?? [];
    if (!from.includes(v.from)) from.push(v.from);
    byValue.set(v.n, from);
  }
  const entries = [...byValue];
  if (entries.length === 1) return `${c.label} is ${entries[0][0]}, not ${n} (${entries[0][1].join(", ")})`;
  return `${c.label} is ${entries.map(([v, from]) => `${v} (${from.join(", ")})`).join(" or ")}, not ${n}`;
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
