// =============================================================================
// stats/period.ts — which stretch of time a recap covers.
//
//   --month 2026-10   → October 2026        (tape label "OCTOBER '26")
//   --year 2026       → all of 2026          (tape label "2026")
//   (nothing)         → the current month so far
// =============================================================================

import type { Period } from "../../contract/recap.ts";
import { MONTH_NAMES, monthEnd, today } from "../lib/time.ts";

export function parsePeriod(opts: { month?: string; year?: string }): Period {
  if (opts.year) {
    const y = Number(opts.year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new Error(`--year must look like 2026 (got "${opts.year}")`);
    return { kind: "year", label: String(y), tapeLabel: String(y), from: `${y}-01-01`, to: `${y}-12-31` };
  }
  const m = (opts.month ?? today().slice(0, 7)).match(/^(\d{4})-(\d{1,2})$/);
  if (!m) throw new Error(`--month must look like 2026-10 (got "${opts.month}")`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`--month must be 01–12 (got "${opts.month}")`);
  const name = MONTH_NAMES[mo - 1];
  return {
    kind: "month",
    label: `${name} ${y}`,
    tapeLabel: `${name.toUpperCase()} '${String(y).slice(2)}`,
    from: `${y}-${String(mo).padStart(2, "0")}-01`,
    to: monthEnd(y, mo),
  };
}

/** Short slug for output file names: "2026-10" or "2026". */
export const periodSlug = (p: Period): string => (p.kind === "month" ? p.from.slice(0, 7) : p.kind === "year" ? p.from.slice(0, 4) : `${p.from}_${p.to}`);
