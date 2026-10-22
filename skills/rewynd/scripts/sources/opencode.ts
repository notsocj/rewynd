// =============================================================================
// sources/opencode.ts — read OpenCode history (read-only). BETA.
//
// Where:  $XDG_DATA_HOME/opencode/ (default ~/.local/share/opencode/;
//         on Windows we also check %LOCALAPPDATA%\opencode\)
//   newer: opencode.db  (SQLite: tables session / message / part, JSON in a `data` column)
//   older: storage/session/<project>/<session>.json
//          storage/message/<session>/<message>.json
//          storage/part/<message>/<part>.json
//
// ⚠ The developer's machine has OpenCode installed but no sessions, so this
// adapter is written from OpenCode's open-source storage code and tested on
// synthetic data only (test/opencode.test.ts). It's defensive on purpose: any
// shape it doesn't recognise → a clear "format not recognised" warning, and
// the rest of rewynd carries on.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { exists, isDir, isWindows, listFiles, xdgDataHome } from "../lib/paths.ts";
import { readJsonFile } from "../lib/files.ts";
import { toMs } from "../lib/time.ts";
import { warn, errMsg } from "../lib/log.ts";
import { categorize, categorizeCommand } from "./tool-categories.ts";
import { openReadOnly } from "./sqlite.ts";
import { newSession, type AgentAdapter, type DateRange, type Session } from "./types.ts";

function baseDirs(): string[] {
  const dirs = [path.join(xdgDataHome(), "opencode")];
  if (isWindows && process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, "opencode"));
  return dirs.filter(isDir);
}
const dbFile = (base: string) => path.join(base, "opencode.db");
const storageDir = (base: string) => path.join(base, "storage");

export const opencode: AgentAdapter = {
  id: "opencode",

  async detect() {
    const bases = baseDirs();
    if (!bases.length) return { found: false, paths: [], note: "OpenCode isn't installed (no opencode data folder)" };
    const found: string[] = [];
    for (const b of bases) {
      if (exists(dbFile(b))) found.push(dbFile(b));
      if (isDir(path.join(storageDir(b), "message"))) found.push(storageDir(b));
    }
    return found.length
      ? { found: true, paths: found }
      : { found: false, paths: bases, note: "installed, but no sessions yet (no opencode.db or storage/)" };
  },

  async *collect(range: DateRange) {
    const fromMs = Date.parse(range.from + "T00:00:00Z") - 86400000;
    for (const base of baseDirs()) {
      if (exists(dbFile(base))) {
        try {
          yield* fromSqlite(dbFile(base), fromMs);
        } catch (e) {
          warn(`OpenCode: skipped the database (${errMsg(e)})`);
        }
      }
      if (isDir(path.join(storageDir(base), "message"))) {
        try {
          yield* fromStorage(storageDir(base), fromMs);
        } catch (e) {
          warn(`OpenCode: skipped the storage folder (${errMsg(e)})`);
        }
      }
    }
  },
};

// -----------------------------------------------------------------------------
// Shared: turn OpenCode's message + part objects into our Session
// -----------------------------------------------------------------------------

type OcSession = { id: string; directory?: string; parentID?: string | null; created?: number };

function buildSession(meta: OcSession, messages: any[], partsByMessage: Map<string, any[]>, file: string): Session | null {
  const s = newSession("opencode", meta.id, file);
  s.cwd = meta.directory ?? null;
  for (const m of messages) {
    const at = toMs(m?.time?.created ?? m?.time_created ?? m?.created);
    if (at === null) continue;
    const parts = partsByMessage.get(String(m.id)) ?? [];
    if (m.role === "user") {
      const text = parts.filter((p) => p?.type === "text" && !p.synthetic).map((p) => String(p.text ?? "")).join("\n");
      s.messages.push({ role: "user", at, text });
    } else if (m.role === "assistant") {
      const model = String(m.modelID ?? m.model ?? "unknown");
      s.messages.push({ role: "assistant", at, model });
      s.models[model] = (s.models[model] ?? 0) + 1;
      const t = m.tokens ?? {};
      s.usage.push({
        at,
        tokensIn: Number(t.input ?? 0) + Number(t.cache?.read ?? 0) + Number(t.cache?.write ?? 0),
        tokensOut: Number(t.output ?? 0) + Number(t.reasoning ?? 0),
        model,
      });
      for (const p of parts) {
        if (p?.type !== "tool") continue;
        const name = String(p.tool ?? "unknown");
        const category = name === "bash" ? categorizeCommand(p.state?.input?.command) : categorize(name);
        s.toolCalls.push({ at: toMs(p.state?.time?.start) ?? at, name, category });
      }
    }
  }
  if (!s.messages.length) return null;
  if (meta.parentID) {
    s.origin = "automated"; // a sub-agent session spawned by the "task" tool
    s.automatedKind = "subagent";
  } else if (!s.messages.some((m) => m.role === "user")) {
    s.origin = "automated";
    s.automatedKind = "other";
  }
  return s;
}

// -----------------------------------------------------------------------------
// SQLite (newer versions)
// -----------------------------------------------------------------------------

async function* fromSqlite(file: string, fromMs: number): AsyncGenerator<Session> {
  const opened = await openReadOnly(file);
  if (!opened.db) {
    warn(`OpenCode: skipped (${opened.reason})`);
    return;
  }
  const db = opened.db;
  try {
    const tables = new Set(db.tables());
    if (!tables.has("session") || !tables.has("message")) {
      warn("OpenCode: database format not recognised (no session/message tables); skipped");
      return;
    }
    const sCols = new Set(db.columns("session"));
    const mCols = new Set(db.columns("message"));
    const hasParts = tables.has("part") && new Set(db.columns("part")).has("data");
    if (!mCols.has("data") || !mCols.has("session_id")) {
      warn("OpenCode: database format not recognised (message table has no data column); skipped");
      return;
    }
    const updatedCol = sCols.has("time_updated") ? "time_updated" : null;
    const sessions = db.all(
      `SELECT * FROM session${updatedCol ? ` WHERE ${updatedCol} >= ?` : ""}`,
      ...(updatedCol ? [fromMs] : []),
    );
    for (const row of sessions) {
      const meta: OcSession = {
        id: String(row.id),
        directory: row.directory ?? undefined,
        parentID: row.parent_id ?? row.parentID ?? null,
      };
      const messages = db
        .all(`SELECT id, data FROM message WHERE session_id = ?`, meta.id)
        .map((r) => ({ id: r.id, ...(safeJson(r.data) ?? {}) }));
      const parts = new Map<string, any[]>();
      if (hasParts) {
        for (const r of db.all(`SELECT message_id, data FROM part WHERE session_id = ?`, meta.id)) {
          const list = parts.get(String(r.message_id)) ?? [];
          list.push(safeJson(r.data));
          parts.set(String(r.message_id), list);
        }
      }
      const s = buildSession(meta, messages, parts, file);
      if (s) yield s;
    }
  } finally {
    db.close();
  }
}

// -----------------------------------------------------------------------------
// JSON storage folder (older versions)
// -----------------------------------------------------------------------------

async function* fromStorage(dir: string, fromMs: number): AsyncGenerator<Session> {
  const sessionFiles = listFiles(path.join(dir, "session"), (f) => f.endsWith(".json"), 3);
  for (const sf of sessionFiles) {
    const info = readJsonFile<any>(sf, null);
    if (!info?.id) continue;
    const updated = toMs(info.time?.updated ?? info.time?.created) ?? 0;
    if (updated && updated < fromMs) continue;
    const msgDir = path.join(dir, "message", info.id);
    if (!isDir(msgDir)) continue;
    const messages = fs
      .readdirSync(msgDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJsonFile<any>(path.join(msgDir, f), null))
      .filter(Boolean);
    const parts = new Map<string, any[]>();
    for (const m of messages) {
      const partDir = path.join(dir, "part", String(m.id));
      if (!isDir(partDir)) continue;
      parts.set(
        String(m.id),
        fs.readdirSync(partDir).filter((f) => f.endsWith(".json")).map((f) => readJsonFile<any>(path.join(partDir, f), null)).filter(Boolean),
      );
    }
    const s = buildSession({ id: info.id, directory: info.directory, parentID: info.parentID ?? null }, messages, parts, sf);
    if (s) yield s;
  }
}

function safeJson(v: unknown): any {
  if (typeof v !== "string") return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
