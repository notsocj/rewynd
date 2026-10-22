// =============================================================================
// lib/log.ts — tiny console helpers.
//
// Everything human-readable goes to stderr, so stdout stays clean for the one
// JSON summary the skill reads (`node scripts/cli.ts collect` prints JSON).
// Warnings are also remembered, so the final summary can list them
// ("⚠ Skipped Gemini CLI: ...") and Claude can relay them to the user.
// =============================================================================

const warnings: string[] = [];
let quiet = false;

export function setQuiet(q: boolean): void {
  quiet = q;
}

export function info(msg: string): void {
  if (!quiet) process.stderr.write(msg + "\n");
}

export function warn(msg: string): void {
  warnings.push(msg);
  process.stderr.write("⚠ " + msg + "\n");
}

/** All warnings so far (for the JSON summary). */
export function collectedWarnings(): string[] {
  return [...warnings];
}

/** Short message from any thrown value. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
