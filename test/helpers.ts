// Shared helpers for tests: temp folders and tiny JSONL writers.
// Every test writes synthetic data into its own temp folder and points the
// adapters at it through their env overrides, so tests never read your real
// ~/.claude or ~/.codex.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function tempDir(prefix = "rewynd-test-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeJsonl(file: string, records: unknown[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

/** Collect every session an adapter yields. */
export async function all<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

export const iso = (s: string) => new Date(s).toISOString();
