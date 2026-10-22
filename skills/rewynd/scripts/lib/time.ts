// =============================================================================
// lib/time.ts — dates, hours and periods in the USER'S local timezone.
//
// Logs store timestamps in UTC. "You peaked at 3AM" has to mean 3AM where the
// user lives, and "October 21" has to be their October 21, so every bucket
// goes through Intl with an explicit timezone (overridable with --tz).
// =============================================================================

let tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function setTimezone(zone: string | null | undefined): void {
  if (!zone) return;
  // Throws a clear RangeError for a typo like "Asia/Manilla".
  new Intl.DateTimeFormat("en-US", { timeZone: zone });
  tz = zone;
  partsFmt = makeFmt();
}

export const timezone = (): string => tz;

function makeFmt() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
}
let partsFmt = makeFmt();

export type LocalParts = {
  /** "YYYY-MM-DD" */
  date: string;
  /** 0–23 */
  hour: number;
  minute: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
};

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

// Formatting dates is the hot path of a full scan (hundreds of thousands of
// events), so results are cached per minute: every event in the same minute
// shares one lookup.
const cache = new Map<number, LocalParts>();

/** Local date/hour/weekday of an epoch-milliseconds timestamp. */
export function local(ms: number): LocalParts {
  const minuteKey = Math.floor(ms / 60000);
  const hit = cache.get(minuteKey);
  if (hit) return hit;
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(new Date(minuteKey * 60000))) p[part.type] = part.value;
  const res: LocalParts = {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS[p.weekday] ?? 0,
  };
  if (cache.size > 500_000) cache.clear(); // keep memory bounded on huge histories
  cache.set(minuteKey, res);
  return res;
}

export const localDate = (ms: number): string => local(ms).date;

/** "HH:MM" local time, used for first/last activity of a project in a day. */
export function localHHMM(ms: number): string {
  const l = local(ms);
  return `${String(l.hour).padStart(2, "0")}:${String(l.minute).padStart(2, "0")}`;
}

/** Parse an ISO string / epoch seconds / epoch ms into epoch ms (or null). */
export function toMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v; // seconds vs ms
  if (typeof v === "string" && v) {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Today's local date. */
export const today = (): string => localDate(Date.now());

// -----------------------------------------------------------------------------
// Plain calendar-date math on "YYYY-MM-DD" strings (no timezone involved)
// -----------------------------------------------------------------------------

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Every date from `from` to `to`, inclusive. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

/** 0 = Monday … 6 = Sunday, for a calendar date. */
export function weekdayOf(date: string): number {
  return (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Last calendar day of a month, "YYYY-MM-DD". */
export function monthEnd(year: number, month1: number): string {
  const d = new Date(Date.UTC(year, month1, 0)); // day 0 of next month = last day of this one
  return d.toISOString().slice(0, 10);
}
