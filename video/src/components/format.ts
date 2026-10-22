// Small text-formatting helpers used across scenes. All output is English
// and US-style ("1,240", "OCT 21", "2AM"), so videos look the same on every
// machine no matter its locale.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** 1240 → "1,240". */
export const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** "2026-10-21" → "OCT 21". Reads the date parts directly instead of using
 *  Date(), so the timezone of the rendering machine can't shift the day. */
export const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
};

/** "2026-10-21" → "OCT 21 2026" (camcorder date-stamp style). */
export const stampDay = (iso: string) => `${shortDay(iso)} ${iso.slice(0, 4)}`;

/** "2026-10-21" → day of week, 0 = Monday … 6 = Sunday. Computed in UTC
 *  from the date parts so it's the same everywhere. */
export const weekday = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

/** 0 → "12AM", 2 → "2AM", 13 → "1PM". */
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "AM" : "PM"}`;

/** Minutes → "86h 12m" style, or "45m" under an hour. */
export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${num(h)}h ${m}m` : `${m}m`;
};

/** "1 session" / "2 sessions". */
export const plural = (n: number, word: string, many = `${word}s`) => `${num(n)} ${n === 1 ? word : many}`;

/** "October 2026" → "October"; a year label stays as it is. Used for
 *  "Your October in AI coding". */
export const periodName = (kind: string, label: string) => (kind === "month" ? label.split(" ")[0] : label);
