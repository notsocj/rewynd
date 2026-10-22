// =============================================================================
// lib/files.ts — safe JSON reading/writing for rewynd's OWN files.
//
// (Agent logs are never written. These helpers are only used on data/ and
// output/.)
// =============================================================================

import fs from "node:fs";
import path from "node:path";

/** Read a JSON file, or return `fallback` if it's missing or broken. */
export function readJsonFile<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Write JSON atomically: write "<file>.tmp", then rename over the real file.
 * A rename is all-or-nothing, so a crash or Ctrl-C mid-write can never leave
 * a half-written day file that later fails to load.
 */
export function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file);
}
