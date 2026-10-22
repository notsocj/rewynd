// Redaction, tool categories, story validation, periods, percentages.

import { test } from "node:test";
import assert from "node:assert/strict";
import { redact } from "../skills/rewynd/scripts/samples/redact.ts";
import { categorize, categorizeCommand } from "../skills/rewynd/scripts/sources/tool-categories.ts";
import { bugNumbersFrom, knownNumbers, numbersIn, validateStory } from "../skills/rewynd/scripts/story/validate-story.ts";
import { typedText } from "../skills/rewynd/scripts/sources/user-text.ts";
import { parsePeriod, previousPeriod } from "../skills/rewynd/scripts/stats/period.ts";
import { resolveTheme, loadThemes } from "../skills/rewynd/scripts/render/render.ts";
import { DEFAULT_PREFS } from "../skills/rewynd/contract/recap.ts";
import { roundToHundred } from "../skills/rewynd/scripts/stats/build-stats.ts";
import type { Stats } from "../skills/rewynd/contract/recap.ts";

test("redact: keys, tokens, env lines, emails, home paths, URL credentials", () => {
  const input = [
    "my key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
    "export STRIPE_SECRET=sk_live_abcdefghijklmnop1234",
    "DATABASE_URL=postgres://admin:hunter2@db.example.com/app",
    "token: ghp_0123456789abcdefghijklmnopqrstuvwxyzAB",
    "mail me at jane.doe@example.com",
    "see /Users/jane/Documents/secret-project/a.ts",
    "curl https://user:pass@example.com/x?token=abc123&page=2",
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
  ].join("\n");
  const out = redact(input);
  for (const leak of ["sk-ant-api03", "sk_live_", "hunter2", "ghp_0123", "jane.doe", "/Users/jane", "user:pass", "abc123", "abcdefghijklmnopqrstuvwxyz123456"]) {
    assert.ok(!out.includes(leak), `leaked: ${leak}\n${out}`);
  }
  assert.ok(out.includes("~/Documents"));
  assert.ok(out.includes("page=2"), "harmless query params survive");
});

test("redact leaves ordinary sentences alone", () => {
  const s = "why is the login button still broken on mobile? please fix it";
  assert.equal(redact(s), s);
});

test("tool categories are agent-neutral", () => {
  assert.equal(categorize("Edit"), "edit");
  assert.equal(categorize("apply_patch"), "edit");
  assert.equal(categorize("replace"), "edit");
  assert.equal(categorize("run_shell_command"), "run");
  assert.equal(categorize("mcp__Claude_Browser__navigate"), "web");
  assert.equal(categorize("mcp__Claude_Code_iOS_Simulator__control"), "run");
  assert.equal(categorize("mcp__linear__create_issue"), "mcp");
  assert.equal(categorizeCommand("rg foo src"), "search");
  assert.equal(categorizeCommand("sed -n 1,40p a.ts"), "read");
  assert.equal(categorizeCommand("sed -i '' s/a/b/ a.ts"), "edit");
  assert.equal(categorizeCommand(["bash", "-lc", "cat package.json"]), "read");
  assert.equal(categorizeCommand("cd app && npm test"), "run");
});

test("numbersIn reads numbers the way people write them", () => {
  assert.deepEqual(numbersIn("1,234 commits, 81% AI, peaked at 3AM in OCTOBER '26"), [1234, 81, 3, 26]);
});

function fakeStats(): Stats {
  return {
    schemaVersion: 1, generatedAt: "", timezone: "UTC",
    period: { kind: "month", label: "October 2026", tapeLabel: "OCTOBER '26", from: "2026-10-01", to: "2026-10-31" },
    coverage: { daysInPeriod: 31, daysSaved: 22, gapDays: 0, firstSavedDay: "2026-10-01", lastSavedDay: "2026-10-22" },
    agents: ["claude-code", "codex"], skippedAgents: [],
    totals: { sessions: 300, userMessages: 2707, toolCalls: 47098, tokensIn: 1, tokensOut: 1, activeMinutes: 5160, activeHours: 86, activeDays: 22 },
    byAgent: {}, mainAgent: "claude-code",
    agentShare: [{ agent: "claude-code", share: 0.62, percent: 62 }, { agent: "codex", share: 0.38, percent: 38 }],
    agentSwitches: { sameDay: 14, sameProject: 19, topSwitch: { from: "claude-code", to: "codex", count: 41 } },
    backgroundRuns: { total: 702, byAgent: { codex: { review: 702, subagent: 0, other: 0 } } },
    projects: [{ name: "lumen", sessions: 5, minutes: 1840, agents: ["claude-code"] }],
    tools: [], models: [],
    time: { busiestDay: { date: "2026-10-21", minutes: 700 }, busiestHour: 2, hours: new Array(24).fill(0), weekdays: new Array(7).fill(0), lateNightSessions: 38, longestStreakDays: 17, heatmap: [] },
    phrases: { please: 31, thanks: 12, fixIt: 44, stillBroken: 3, why: 88, sorry: 9 },
    longestSession: null, personalityHints: [], shipped: null,
    previous: { label: "September 2026", shortLabel: "SEP", activeMinutes: 4260, sessions: 251, changePct: 21 },
  };
}

const goodStory = {
  schemaVersion: 1,
  personality: { id: "3am-shipper", title: "The 3AM Shipper", line: "38 sessions after midnight. Sleep is a suggestion." },
  captions: { hours: "86 hours with AI this month", mainAI: "You cheated on Claude Code with Codex 41 times" },
  projects: [{ name: "lumen", line: "lumen: mostly fighting auth" }],
  hardestBug: null,
  funnyLines: ["You said 'why' 88 times.", "Up 21% on September."],
  backgroundLine: "Codex double-checked itself 702 times.",
  closing: "See you next month.",
};

test("story check: real numbers pass", () => {
  const r = validateStory(goodStory, fakeStats());
  assert.deepEqual(r.errors, []);
});

test("story check: invented numbers, unknown personality and long captions fail", () => {
  const bad = { ...goodStory, personality: { ...goodStory.personality, id: "wizard" }, funnyLines: ["You said 'fix it' 9999 times."], captions: { hours: "x".repeat(200) } };
  const r = validateStory(bad, fakeStats());
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("9999")));
  assert.ok(r.errors.some((e) => e.includes("personality.id")));
  assert.ok(r.errors.some((e) => e.includes("characters")));
});

test("story check: the hardest-bug line may use its session's counts from samples.json, nothing else may", () => {
  const story = { ...goodStory, hardestBug: { project: "lumen", line: "A login loop that took 57 messages to kill" }, funnyLines: ["57 messages about one bug."] };
  const bugs = bugNumbersFrom({ bugCandidates: [{ bugMessages: 57, userMessages: 140 }] });
  const r = validateStory(story, fakeStats(), bugs);
  assert.ok(!r.errors.some((e) => e.startsWith("hardestBug.line")), r.errors.join("\n"));
  assert.ok(r.errors.some((e) => e.startsWith("funnyLines[0]") && e.includes("57")));
  assert.ok(validateStory(story, fakeStats()).errors.some((e) => e.startsWith("hardestBug.line")), "without samples.json the number is unknown");
});

// --- honesty: wording that names a stat must use THAT stat ---
// Each case uses a wrong number that DOES exist elsewhere in stats.json, which
// the old "any number anywhere" check let through.

function claimStats(): Stats {
  const s = fakeStats();
  s.phrases = { please: 31, thanks: 12, fixIt: 44, stillBroken: 3, why: 29, sorry: 9 };
  s.projects = [{ name: "lumen", sessions: 125, minutes: 1840, agents: ["claude-code"] }, { name: "fernpost", sessions: 46, minutes: 620, agents: ["codex"] }];
  s.time.lateNightSessions = 45;
  s.agentSwitches = { sameDay: 14, sameProject: 19, topSwitch: { from: "claude-code", to: "codex", count: 21 } };
  s.backgroundRuns = { total: 760, byAgent: { codex: { review: 702, subagent: 0, other: 0 }, "claude-code": { review: 0, subagent: 58, other: 0 } } };
  s.byAgent = { "claude-code": { sessions: 190, userMessages: 1, toolCalls: 1, tokensIn: 1, tokensOut: 1, activeMinutes: 3300 }, codex: { sessions: 110, userMessages: 1, toolCalls: 1, tokensIn: 1, tokensOut: 1, activeMinutes: 1860 } };
  s.longestSession = { project: "lumen", agent: "claude-code", minutes: 412, date: "2026-10-09" };
  s.totals.activeMinutes = 5172; // 86.2 hours
  s.totals.activeHours = 86.2;
  s.tools = [{ category: "edit", label: "Edit files", count: 87 }, { category: "run", label: "Run commands", count: 301 }, { category: "read", label: "Read files", count: 20 }];
  s.shipped = {
    commits: 64, aiCommits: 51, aiCommitsByAgent: { claude: 33, codex: 18, copilot: 0, unknown: 0 }, codexConfidence: { exact: 18, branch: 0, time: 0 },
    aiShare: 0.797, linesAdded: 9100, linesRemoved: 2300,
    byRepo: [{ name: "lumen", commits: 40, aiCommits: 35, linesAdded: 1, linesRemoved: 1 }, { name: "fernpost", commits: 24, aiCommits: 16, linesAdded: 1, linesRemoved: 1 }],
    biggestDay: { date: "2026-10-21", commits: 17 },
  };
  return s;
}

/** Errors for one funny line checked against claimStats(). */
function lineErrors(line: string): string[] {
  return validateStory({ ...goodStory, captions: {}, personality: { ...goodStory.personality, line: "Sleep is a suggestion." }, backgroundLine: null, funnyLines: [line] }, claimStats()).errors;
}

test("story check: a stale \"why\" count fails even when the number is some other stat (125 vs 29)", () => {
  assert.ok(knownNumbers(claimStats()).has(125), "125 is in stats.json (lumen sessions)");
  const errors = lineErrors('You asked "why" 125 times.');
  assert.equal(errors.length, 1, errors.join("\n"));
  assert.match(errors[0], /^funnyLines\[0\]: "why" count is 29, not 125 \(phrases\.why\)/);
  assert.deepEqual(lineErrors('You asked "why" 29 times.'), []);
  assert.deepEqual(lineErrors('You asked "why?" 29 times.'), []);
  assert.deepEqual(lineErrors("29 whys."), []);
});

test("story check: phrase counts match their own phrase", () => {
  for (const [ok, bad, msg] of [
    ["You said please 31 times.", "You said please 12 times.", '"please" count is 31, not 12'],
    ["Thanked the AI 12 times.", "Said thanks 31 times.", '"thanks" count is 12, not 31'],
    ["You typed 'fix it' 44 times.", "You typed 'fix it' 45 times.", '"fix it" count is 44, not 45'],
    ['"still broken" x3.', '"still broken" 9 times.', '"still broken" count is 3, not 9'],
    ["Said sorry to a computer 9 times.", "Said sorry to a computer 12 times.", '"sorry" count is 9, not 12'],
  ]) {
    assert.deepEqual(lineErrors(ok), [], ok);
    assert.ok(lineErrors(bad).some((e) => e.includes(msg)), `${bad}\n${lineErrors(bad).join("\n")}`);
  }
  // Pairs may use the sum.
  assert.deepEqual(lineErrors("Please and thanks: 43 times."), []);
  assert.deepEqual(lineErrors('"fix it" or "still broken": 47 times.'), []);
});

test("story check: late nights, agent switches, reviews and helpers", () => {
  assert.deepEqual(lineErrors("45 sessions after midnight."), []);
  assert.ok(lineErrors("46 sessions after midnight.").some((e) => e.includes("late-night session count is 45, not 46")));
  assert.deepEqual(lineErrors("You cheated on Claude Code with Codex 21 times."), []);
  assert.deepEqual(lineErrors("You switched agents on 14 days."), [], "sameDay counts too");
  assert.ok(lineErrors("You cheated on Claude Code with Codex 20 times.").some((e) => e.includes("agent switch count is 21") && e.endsWith("not 20. Use the real number")));
  assert.deepEqual(lineErrors("Codex double-checked itself 702 times."), []);
  assert.ok(lineErrors("Codex double-checked itself 760 times.").some((e) => e.includes("background review count is 702, not 760")));
  assert.deepEqual(lineErrors("Your agents spun up 58 little helpers."), []);
  assert.ok(lineErrors("Your agents spun up 87 little helpers.").some((e) => e.includes("sub-agent (helper) count is 58, not 87")));
});

test("story check: hours, sessions, commits and AI share match their stat", () => {
  // Hours: rounded down like the video, or to 1 decimal.
  assert.deepEqual(lineErrors("86 hours with AI."), []);
  assert.deepEqual(lineErrors("86.2 hours with AI."), []);
  assert.ok(lineErrors("87 hours with AI.").some((e) => e.includes("total active hours is 86") && e.includes("not 87") && e.includes("longest session")), "rounding up fails, and the error says how to name another stat");
  assert.deepEqual(lineErrors("Longest session: 7 hours."), [], "412 minutes ≈ 7 hours");
  assert.deepEqual(lineErrors("lumen alone: 30 hours."), [], "a named project uses its own minutes");
  // Sessions.
  assert.deepEqual(lineErrors("300 sessions this month."), []);
  assert.ok(lineErrors("125 sessions this month.").some((e) => e.includes("total session count is 300, not 125")));
  assert.deepEqual(lineErrors("125 sessions in lumen."), []);
  assert.deepEqual(lineErrors("Codex: 110 sessions."), []);
  // Commits.
  assert.deepEqual(lineErrors("64 commits shipped."), []);
  assert.deepEqual(lineErrors("51 AI commits."), []);
  assert.deepEqual(lineErrors("lumen got 40 commits."), []);
  assert.deepEqual(lineErrors("17 commits on your biggest day."), []);
  assert.ok(lineErrors("46 commits shipped.").some((e) => e.includes("shipped commit count is") && e.includes("not 46")));
  assert.ok(lineErrors("fernpost got 40 commits.").some((e) => e.includes("fernpost commits is 24") && e.includes("not 40")));
  // AI share.
  assert.deepEqual(lineErrors("80% AI."), []);
  assert.deepEqual(lineErrors("80% of your commits had an AI co-author."), []);
  assert.ok(lineErrors("62% of your commits had an AI co-author.").some((e) => e.includes("AI share of commits (%) is 80") && e.includes("not 62")));
  // A line project's name counts as naming it.
  const story = (line: string) => ({ ...goodStory, captions: {}, personality: { ...goodStory.personality, line: "Sleep is a suggestion." }, funnyLines: [], backgroundLine: null, projects: [{ name: "fernpost", line }] });
  assert.deepEqual(validateStory(story("46 sessions of polish"), claimStats()).errors, []);
  assert.ok(validateStory(story("125 sessions of polish"), claimStats()).errors.some((e) => e.includes("fernpost sessions is 46, not 125")));
});

test("story check: numbers no wording claims still only need to exist in stats.json", () => {
  assert.deepEqual(lineErrors("Up 21% on September."), []);
  assert.deepEqual(lineErrors("17 days in a row. Touch grass?"), []);
  assert.deepEqual(lineErrors("Peak focus: 2AM, OCTOBER '26."), []);
  assert.deepEqual(lineErrors("Why? 301 commands later, it worked."), [], "a keyword in another clause doesn't claim the number");
  const errors = lineErrors("You ran 302 commands.");
  assert.ok(errors.some((e) => e.includes("the number 302 isn't in stats.json")), errors.join("\n"));
});

test("typed text: the app's wrappers are peeled off, app-only messages are dropped", () => {
  // Claude desktop: page context before your text.
  assert.equal(typedText('<artifact-view-context artifact="a1">\n{"mode":"canvas"}\n</artifact-view-context>\n\nmake the header smaller'), "make the header smaller");
  // A paste, then your words.
  assert.equal(typedText('<pasted_content id="p1">\nTypeError: x is undefined\n</pasted_content id="p1">\n\nwhy does this happen'), "why does this happen");
  // Codex IDE preamble: only the request is yours.
  assert.equal(typedText("# Files mentioned by the user:\n\n## shot.png: /Users/jane/Desktop/shot.png\n\n## My request for Codex:\nfix the login page\n"), "fix the login page");
  assert.equal(typedText("# Files mentioned by the user:\n\n## notes.md: /tmp/notes.md\n"), "");
  // Codex in-app browser context.
  assert.equal(typedText('<in-app-browser-context tab="1">\n# In app browser:\nlocalhost:3000\n</in-app-browser-context>\n\n## My request:\nwhy is the button grey'), "why is the button grey");
  // Wholly the app's: an attached skill, a page it opened, a scheduled heartbeat.
  assert.equal(typedText("<skill>\n<name>animate</name>\n---\nWhy animate? Fix it with springs.\n</skill>"), null);
  assert.equal(typedText('<external_codex_apps_open_page>{"page_id":null}</external_codex_apps_open_page>'), null);
  assert.equal(typedText("<heartbeat>\n<automation_id>a</automation_id>\n</heartbeat>"), null);
  // You, but no prose.
  assert.equal(typedText("<bash-input>git status</bash-input><bash-stdout>clean</bash-stdout>"), "");
  // Attached images keep no file name.
  assert.equal(typedText('look at this <image name=[Image #1] path="/Users/jane/Desktop/jane-passport.png"></image> why'), "look at this [image] why");
  // Plain text is untouched.
  assert.equal(typedText("please fix it"), "please fix it");
});

test("periods and percentages", () => {
  const p = parsePeriod({ month: "2026-10" });
  assert.equal(p.label, "October 2026");
  assert.equal(p.tapeLabel, "OCTOBER '26");
  assert.equal(p.to, "2026-10-31");
  assert.equal(parsePeriod({ month: "2028-02" }).to, "2028-02-29");
  assert.equal(parsePeriod({ year: "2026" }).tapeLabel, "2026");
  assert.deepEqual(roundToHundred([33.3, 33.3, 33.4]), [33, 33, 34]);
  assert.equal(roundToHundred([62.4, 30.4, 7.2]).reduce((a, b) => a + b, 0), 100);
});

test("previous period: last month / last year", () => {
  assert.equal(previousPeriod(parsePeriod({ month: "2026-10" }))!.label, "September 2026");
  assert.equal(previousPeriod(parsePeriod({ month: "2026-01" }))!.label, "December 2025");
  assert.equal(previousPeriod(parsePeriod({ year: "2026" }))!.label, "2025");
});

test("templates: every template has 3 accents; auto, legacy ids and bad accents resolve", () => {
  const { themes } = loadThemes();
  assert.deepEqual(themes.map((t) => t.id), ["tape", "terminal", "receipt", "arcade"]);
  for (const t of themes) assert.equal(t.accents.length, 3, t.id);
  const story = { personality: { id: "3am-shipper" } } as any;
  assert.deepEqual(resolveTheme({ ...DEFAULT_PREFS, theme: "auto" }, story), { theme: "tape", accent: "mint" });
  assert.deepEqual(resolveTheme({ ...DEFAULT_PREFS, theme: "night" }, story), { theme: "tape", accent: "mint" });
  assert.deepEqual(resolveTheme({ ...DEFAULT_PREFS, theme: "arcade", accent: "nope" }, story), { theme: "arcade", accent: "yellow" });
  assert.deepEqual(resolveTheme({ ...DEFAULT_PREFS, theme: "receipt", accent: "blue" }, story), { theme: "receipt", accent: "blue" });
});
