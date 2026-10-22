// =============================================================================
// sources/phrases.ts — count fun phrases in YOUR messages ("please", "still broken").
//
// Only the counts are kept. The message text itself is dropped right after
// counting and never written anywhere.
// =============================================================================

export type Phrases = { please: number; thanks: number; fixIt: number; stillBroken: number; why: number; sorry: number };

export const emptyPhrases = (): Phrases => ({ please: 0, thanks: 0, fixIt: 0, stillBroken: 0, why: 0, sorry: 0 });

// Each pattern counts occurrences (not just "did the message contain it").
const PATTERNS: Record<keyof Phrases, RegExp> = {
  please: /\b(please|pls|plz)\b/g,
  thanks: /\b(thanks|thank you|thx|ty|tysm)\b/g,
  fixIt: /\bfix (it|this|that|them|these)\b/g,
  stillBroken: /\b(still (broken|not working|doesn'?t work|failing|fails|wrong|the same|happening)|not working( again)?)\b/g,
  why: /\bwhy\b/g,
  sorry: /\b(sorry|my bad|apologi[sz]e)\b/g,
};

/** Add the phrase counts of one message to `into`. */
export function countPhrases(text: string, into: Phrases): void {
  const t = text.toLowerCase();
  for (const key of Object.keys(PATTERNS) as (keyof Phrases)[]) {
    const m = t.match(PATTERNS[key]);
    if (m) into[key] += m.length;
  }
}

export function addPhrases(a: Phrases, b: Phrases): Phrases {
  const out = emptyPhrases();
  for (const k of Object.keys(out) as (keyof Phrases)[]) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return out;
}

/** Does this message look like a bug report? Used to find the "hardest bug" session. */
export function isBugMessage(text: string): boolean {
  return /\b(fix|bug|broken|error|fail(s|ed|ing)?|crash(es|ed)?|not working|doesn'?t work|exception|undefined|null|why)\b/i.test(text);
}
