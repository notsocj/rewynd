// =============================================================================
// lib/args.ts — minimal command-line parsing (no dependency needed).
//
//   node scripts/cli.ts collect --month 2026-10 --github --data-dir "/x"
//   → { command: "collect", flags: { month: "2026-10", github: true, "data-dir": "/x" } }
// =============================================================================

export type Parsed = { command: string; flags: Record<string, string | boolean>; rest: string[] };

export function parseArgs(argv: string[]): Parsed {
  const [command = "help", ...tail] = argv;
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];
  for (let i = 0; i < tail.length; i++) {
    const a = tail[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1); // --month=2026-10
      } else {
        const next = tail[i + 1];
        // "--github" alone is a boolean; "--month 2026-10" takes the next value.
        // An empty next value ("") still counts as a value: the skill may pass
        // --data-dir "" when a placeholder wasn't substituted.
        if (next !== undefined && !next.startsWith("--")) {
          flags[a.slice(2)] = next;
          i++;
        } else flags[a.slice(2)] = true;
      }
    } else rest.push(a);
  }
  return { command, flags, rest };
}

export function str(flags: Parsed["flags"], name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}
