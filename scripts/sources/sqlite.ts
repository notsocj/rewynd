// =============================================================================
// sources/sqlite.ts — open another app's SQLite database READ-ONLY.
//
// OpenCode (and later Cursor / Antigravity) keep history in SQLite. We:
//   1. prefer Node's built-in `node:sqlite` (Node ≥ 22.13): no native package,
//      nothing to compile, works everywhere Node works;
//   2. fall back to `better-sqlite3` if the user happens to have it installed;
//   3. otherwise return null with a clear reason, and the adapter skips that
//      agent with a warning instead of crashing the run.
//
// Safety: the database is opened read-only. We never write to, vacuum, or
// migrate another tool's database. If it's locked (the app is mid-write) the
// query fails, and the caller skips that agent for this run.
// =============================================================================

import { createRequire } from "node:module";

/** The tiny subset of a SQLite API the adapters need. */
export type ReadOnlyDb = {
  all(sql: string, ...params: unknown[]): any[];
  tables(): string[];
  columns(table: string): string[];
  close(): void;
};

export type OpenResult = { db: ReadOnlyDb } | { db: null; reason: string };

export async function openReadOnly(file: string): Promise<OpenResult> {
  // 1) node:sqlite
  try {
    const mod: any = await import("node:sqlite");
    const raw = new mod.DatabaseSync(file, { readOnly: true });
    return { db: wrap((sql, params) => raw.prepare(sql).all(...params), () => raw.close()) };
  } catch (e: any) {
    if (e?.code !== "ERR_UNKNOWN_BUILTIN_MODULE" && e?.code !== "ERR_MODULE_NOT_FOUND") {
      return { db: null, reason: `couldn't open the database read-only (${e?.message ?? e})` };
    }
  }
  // 2) better-sqlite3 (optional, only if the user installed it)
  try {
    const require = createRequire(import.meta.url);
    const Better = require("better-sqlite3");
    const raw = new Better(file, { readonly: true, fileMustExist: true });
    return { db: wrap((sql, params) => raw.prepare(sql).all(...params), () => raw.close()) };
  } catch {
    return { db: null, reason: "reading SQLite needs Node 22.13+ (built-in node:sqlite) or `npm i better-sqlite3`" };
  }
}

function wrap(all: (sql: string, params: unknown[]) => any[], close: () => void): ReadOnlyDb {
  return {
    all: (sql, ...params) => all(sql, params),
    tables: () => all("SELECT name FROM sqlite_master WHERE type='table'", []).map((r) => String(r.name)),
    columns: (table) => all(`PRAGMA table_info("${table.replace(/"/g, '""')}")`, []).map((r) => String(r.name)),
    close,
  };
}
