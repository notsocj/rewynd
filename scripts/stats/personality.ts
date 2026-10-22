// =============================================================================
// stats/personality.ts — rank the fixed coder personalities from real numbers.
//
// Claude makes the final pick and writes the funny line (story.json), but a
// script-made ranking keeps results consistent: two people with very similar
// numbers shouldn't get wildly different personalities depending on the mood
// of the model. Each score is 0–1 with a plain reason built from real counts.
// =============================================================================

import type { PersonalityId, Stats } from "../../contract/recap.ts";

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function rankPersonalities(s: Omit<Stats, "personalityHints">): Stats["personalityHints"] {
  const minutes = s.totals.activeMinutes || 1;
  const msgs = s.totals.userMessages || 1;
  const sessions = s.totals.sessions || 1;
  const tool = (c: string) => s.tools.find((t) => t.category === c)?.count ?? 0;
  const edits = tool("edit");
  const readsSearches = tool("read") + tool("search");
  const allTools = s.tools.reduce((a, t) => a + t.count, 0) || 1;
  const nightMinutes = s.time.hours.slice(0, 5).reduce((a, b) => a + b, 0);
  const weekendMinutes = (s.time.weekdays[5] ?? 0) + (s.time.weekdays[6] ?? 0);
  const avgSession = s.totals.activeMinutes / sessions;
  const p = s.phrases;

  const rows: { id: PersonalityId; raw: number; reason: string }[] = [
    {
      id: "3am-shipper",
      raw: (nightMinutes / minutes) / 0.3 + (s.time.lateNightSessions / sessions) * 0.5,
      reason: `${pct(nightMinutes / minutes)} of your time was between midnight and 5AM; ${s.time.lateNightSessions} sessions started after midnight`,
    },
    {
      id: "rewriter",
      raw: (edits / allTools) * 1.6 + (s.shipped && s.shipped.linesAdded ? (s.shipped.linesRemoved / s.shipped.linesAdded) * 0.5 : 0),
      reason: `${pct(edits / allTools)} of tool use was editing files${s.shipped ? `; ${s.shipped.linesRemoved} lines removed vs ${s.shipped.linesAdded} added` : ""}`,
    },
    {
      id: "polite-one",
      raw: ((p.please + p.thanks) / msgs) * 3,
      reason: `"please" ${p.please} times and "thanks" ${p.thanks} times in ${s.totals.userMessages} messages`,
    },
    {
      id: "speedrunner",
      raw: clamp((25 - avgSession) / 25) * clamp(sessions / 40),
      reason: `${s.totals.sessions} sessions averaging ${Math.round(avgSession)} active minutes each`,
    },
    {
      id: "bug-whisperer",
      raw: ((p.fixIt + p.stillBroken + p.why) / msgs) * 4,
      reason: `"fix it" ${p.fixIt}×, "still broken" ${p.stillBroken}×, "why" ${p.why}×`,
    },
    {
      id: "architect",
      raw: (readsSearches / Math.max(edits, 1) - 1) / 4,
      reason: `${readsSearches} reads/searches vs ${edits} edits`,
    },
    {
      id: "juggler",
      raw: s.projects.length / 15 + (s.agents.length - 1) * 0.2,
      reason: `${s.projects.length} projects across ${s.agents.length} agent${s.agents.length === 1 ? "" : "s"}`,
    },
    {
      id: "marathoner",
      raw: (s.longestSession?.minutes ?? 0) / 600 + avgSession / 240,
      reason: `longest session ${s.longestSession?.minutes ?? 0} minutes`,
    },
    {
      id: "weekend-warrior",
      raw: (weekendMinutes / minutes - 0.2) * 2.5,
      reason: `${pct(weekendMinutes / minutes)} of your time was on weekends`,
    },
  ];
  // Sort by the raw (unclamped) score so two "maxed out" traits still have a
  // clear winner, then report the 0–1 value.
  return rows
    .sort((a, b) => b.raw - a.raw)
    .map(({ raw, ...r }) => ({ ...r, score: Math.round(clamp(raw) * 100) / 100 }));
}
