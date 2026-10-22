// =============================================================================
// samples/pick-samples.ts — choose a SMALL, redacted sample of your messages
// for Claude to write the story from (output/samples.json).
//
// Rules (rewynd-context.md §6, §9, §11):
//   - human sessions only, inside the chosen period, from transcripts still on disk
//   - ~150 messages max, each cut to 280 characters, spread across projects
//     and days so one huge session doesn't dominate
//   - redacted BEFORE it's written to disk
//   - plus up to 5 "hardest bug" candidates: the sessions with the most
//     bug-ish messages ("fix", "still broken", "error"...)
// Budget: ~150 × 280 chars ≈ 10k tokens, so story writing stays cheap.
// =============================================================================

import type { Period } from "../../contract/recap.ts";
import { localDate } from "../lib/time.ts";
import { isBugMessage } from "../sources/phrases.ts";
import { projectOf } from "../sources/project-name.ts";
import type { Session } from "../sources/types.ts";
import { redact } from "./redact.ts";

export const MAX_SAMPLES = 150;
const MAX_CHARS = 280;
const PER_PROJECT_POOL = 80;

export type Sample = { agent: string; project: string; date: string; text: string };
export type BugCandidate = { agent: string; project: string; date: string; bugMessages: number; userMessages: number; firstMessage: string; bugLines: string[] };

export type SamplesFile = {
  schemaVersion: 1;
  period: Period;
  note: string;
  /** Date range of the transcripts these samples came from. */
  onDisk: { from: string | null; to: string | null };
  messages: Sample[];
  bugCandidates: BugCandidate[];
};

// Messages that are pasted logs/code rather than you talking.
const NOISY = /^\s*(<|```|\{|\[|\$ |at |Error:|Traceback|diff --git)/;

/** Deterministic pseudo-random number from a string, so samples don't change between runs. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const clip = (s: string, n: number) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
};

export class SamplePicker {
  private pools = new Map<string, { score: number; sample: Sample }[]>();
  private bugs: BugCandidate[] = [];
  private minDate: string | null = null;
  private maxDate: string | null = null;
  private period: Period;

  // (A plain field + assignment, not `constructor(private period)`: Node's
  // type-stripping can't run TypeScript parameter properties.)
  constructor(period: Period) {
    this.period = period;
  }

  add(s: Session): void {
    if (s.origin !== "human") return;
    const project = projectOf(s.cwd)?.name ?? "unknown project";
    const userMsgs = s.messages.filter((m) => m.role === "user" && m.text && m.text.trim().length >= 12);
    let bugCount = 0;
    const bugLines: string[] = [];
    for (const m of userMsgs) {
      const date = localDate(m.at);
      if (date < this.period.from || date > this.period.to) continue;
      if (!this.minDate || date < this.minDate) this.minDate = date;
      if (!this.maxDate || date > this.maxDate) this.maxDate = date;
      const text = m.text!;
      const noisy = NOISY.test(text) || text.length > 4000; // pasted logs/code, not you
      if (isBugMessage(text)) {
        bugCount++;
        // A pasted stack trace still counts as a bug message, but only your own words are quoted.
        if (!noisy && bugLines.length < 4) bugLines.push(clip(redact(text), 200));
      }
      if (noisy) continue;
      // Keep a bounded pool per project, preferring a deterministic random spread.
      const pool = this.pools.get(project) ?? [];
      const sample = { agent: s.agent, project, date, text: clip(redact(text), MAX_CHARS) };
      pool.push({ score: hash(text), sample });
      if (pool.length > PER_PROJECT_POOL) {
        pool.sort((a, b) => a.score - b.score);
        pool.pop();
      }
      this.pools.set(project, pool);
    }
    if (bugCount >= 3) {
      const first = userMsgs.find((m) => !NOISY.test(m.text!)) ?? userMsgs[0];
      this.bugs.push({
        agent: s.agent,
        project,
        date: first ? localDate(first.at) : "",
        bugMessages: bugCount,
        userMessages: userMsgs.length,
        firstMessage: first ? clip(redact(first.text!), 300) : "",
        bugLines,
      });
      this.bugs.sort((a, b) => b.bugMessages - a.bugMessages);
      this.bugs.length = Math.min(this.bugs.length, 5);
    }
  }

  /** Round-robin across projects (biggest pools first) until MAX_SAMPLES. */
  build(): SamplesFile {
    const pools = [...this.pools.values()]
      .map((p) => p.sort((a, b) => a.score - b.score).map((x) => x.sample))
      .sort((a, b) => b.length - a.length);
    const messages: Sample[] = [];
    for (let i = 0; messages.length < MAX_SAMPLES && pools.some((p) => p.length > i); i++) {
      for (const p of pools) {
        if (p[i] && messages.length < MAX_SAMPLES) messages.push(p[i]);
      }
    }
    messages.sort((a, b) => a.date.localeCompare(b.date));
    return {
      schemaVersion: 1,
      period: this.period,
      note: "Redacted sample of the user's own messages. Paraphrase; never quote anything that looks like a secret, a private person's name, or client details.",
      onDisk: { from: this.minDate, to: this.maxDate },
      messages,
      bugCandidates: this.bugs.filter((b) => b.date >= this.period.from && b.date <= this.period.to),
    };
  }
}
