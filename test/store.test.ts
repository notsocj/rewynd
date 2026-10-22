// The daily store: active-minute math, per-day building, and the
// "never shrink a saved day" merge rule.

import { test } from "node:test";
import assert from "node:assert/strict";
import { activeMinutesOf, DayBuilder } from "../skills/rewynd/scripts/store/build-days.ts";
import { mergeDay } from "../skills/rewynd/scripts/store/merge.ts";
import { setTimezone } from "../skills/rewynd/scripts/lib/time.ts";
import { newSession, type Session } from "../skills/rewynd/scripts/sources/types.ts";
import type { DayRecord } from "../skills/rewynd/scripts/store/day.ts";

setTimezone("UTC");
const T = (hhmm: string, date = "2026-10-21") => Date.parse(`${date}T${hhmm}:00Z`);

function session(agent: Session["agent"], times: string[], opts: Partial<Session> = {}): Session {
  const s = newSession(agent, `${agent}-${times[0]}`, "x");
  s.cwd = null;
  times.forEach((t, i) => s.messages.push({ role: i % 2 ? "assistant" : "user", at: T(t), text: i % 2 ? undefined : "please" }));
  return Object.assign(s, opts);
}

test("active minutes: gaps over 15 min don't count; agent work over 60 min after your last message doesn't count", () => {
  // 10:00 → 10:10 (11 minutes), then a 30-minute gap, then 10:40 (1 minute).
  assert.equal(activeMinutesOf([T("10:00"), T("10:10"), T("10:40")]).length, 12);
  // You speak at 10:00; the agent keeps going alone until 12:00 → capped at 11:00.
  const agentAlone = [T("10:00"), ...Array.from({ length: 13 }, (_, i) => T("10:00") + (i + 1) * 10 * 60000)];
  assert.equal(activeMinutesOf(agentAlone, [T("10:00")]).length, 61);
});

test("parallel sessions of different agents count once for the day, but fully per agent", () => {
  const b = new DayBuilder();
  b.add(session("claude-code", ["10:00", "10:09"]));
  b.add(session("codex", ["10:05", "10:14"]));
  const [day] = b.build();
  assert.equal(day.agents["claude-code"]!.activeMinutes, 10);
  assert.equal(day.agents.codex!.activeMinutes, 10);
  assert.equal(day.activeMinutes, 15); // 10:00–10:14, overlap counted once
  assert.equal(day.switches.pairs["claude-code>codex"], 1);
  assert.equal(day.agents["claude-code"]!.phrases.please, 1);
});

test("background runs are counted apart and never add minutes", () => {
  const b = new DayBuilder();
  b.add(session("codex", ["10:00", "10:30"], { origin: "automated", automatedKind: "review" }));
  const [day] = b.build();
  assert.equal(day.activeMinutes, 0);
  assert.equal(day.agents.codex!.sessions, 0);
  assert.equal(day.agents.codex!.automated.review, 1);
});

function dayWith(agents: Record<string, number>, minutes: number): DayRecord {
  const b = new DayBuilder();
  for (const [agent, n] of Object.entries(agents)) {
    const times = Array.from({ length: n * 2 }, (_, i) => `1${Math.floor(i / 60)}:${String(i % 60).padStart(2, "0")}`);
    b.add(session(agent as Session["agent"], times));
  }
  const [d] = b.build();
  d.activeMinutes = minutes;
  return d;
}

test("never shrink: a smaller fresh day (transcripts deleted) keeps the saved numbers", () => {
  const saved = dayWith({ "claude-code": 20 }, 100);
  const fresh = dayWith({ "claude-code": 2 }, 10);
  const { day, changed } = mergeDay(saved, fresh);
  assert.equal(changed, false);
  assert.equal(day.agents["claude-code"]!.userMessages, 20);
  assert.equal(day.activeMinutes, 100);
});

test("grow: today's fresh data replaces a smaller saved day", () => {
  const saved = dayWith({ "claude-code": 2 }, 10);
  const fresh = dayWith({ "claude-code": 20 }, 100);
  const { day, changed } = mergeDay(saved, fresh);
  assert.equal(changed, true);
  assert.equal(day.agents["claude-code"]!.userMessages, 20);
});

test("per agent: a new agent is added without shrinking the others", () => {
  const saved = dayWith({ "claude-code": 20 }, 100); // Claude transcripts later deleted…
  const fresh = dayWith({ gemini: 5 }, 30); // …and a new Gemini adapter arrives
  const { day } = mergeDay(saved, fresh);
  assert.equal(day.agents["claude-code"]!.userMessages, 20);
  assert.equal(day.agents.gemini!.userMessages, 5);
  assert.equal(day.activeMinutes, 100);
});
