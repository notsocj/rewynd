// Redaction, tool categories, story validation, periods, percentages.

import { test } from "node:test";
import assert from "node:assert/strict";
import { redact } from "../scripts/samples/redact.ts";
import { categorize, categorizeCommand } from "../scripts/sources/tool-categories.ts";
import { numbersIn, validateStory } from "../scripts/story/validate-story.ts";
import { parsePeriod } from "../scripts/stats/period.ts";
import { roundToHundred } from "../scripts/stats/build-stats.ts";
import type { Stats } from "../contract/recap.ts";

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
    agentSwitches: { sameDay: 21, sameProject: 26, topSwitch: { from: "claude-code", to: "codex", count: 41 } },
    backgroundRuns: { total: 702, byAgent: { codex: { review: 702, subagent: 0, other: 0 } } },
    projects: [{ name: "lumen", sessions: 5, minutes: 2372, agents: ["claude-code"] }],
    tools: [], models: [],
    time: { busiestDay: { date: "2026-10-21", minutes: 700 }, busiestHour: 2, hours: new Array(24).fill(0), weekdays: new Array(7).fill(0), lateNightSessions: 46, longestStreakDays: 22, heatmap: [] },
    phrases: { please: 52, thanks: 17, fixIt: 67, stillBroken: 1, why: 125, sorry: 25 },
    longestSession: null, personalityHints: [], shipped: null,
  };
}

const goodStory = {
  schemaVersion: 1,
  personality: { id: "3am-shipper", title: "The 3AM Shipper", line: "46 sessions after midnight. Sleep is a suggestion." },
  captions: { hours: "86 hours with AI this month", mainAI: "You cheated on Claude Code with Codex 41 times" },
  projects: [{ name: "lumen", line: "lumen: mostly fighting auth" }],
  hardestBug: null,
  funnyLines: ["You said 'why' 125 times."],
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
