// =============================================================================
// sources/gemini.ts — read Gemini CLI chat history (read-only).
//
// Where:  ~/.gemini/tmp/<project>/chats/session-*.jsonl   (newer: folder = project name)
//         ~/.gemini/tmp/<sha256-of-path>/chats/session-*.json  (older: folder = hash)
//         ~/.gemini/projects.json maps project folders → names
//         ($GEMINI_DATA_DIR or $GEMINI_CLI_HOME override ~/.gemini)
//
// Two formats:
//   .json  — one object: { sessionId, projectHash, startTime, messages: [...] }
//   .jsonl — a small "patch log": a header line, then update lines like
//            {"$set": {"messages": [...], "lastUpdated": "..."}}
//            We apply every message we see and keep the latest copy per id.
//
// Message shape: { id, timestamp, type: "user" | "gemini" | "info" | "error",
//                  content, toolCalls?: [{ name, args }], tokens?: { input, output }, model? }
//
// On the developer's machine every Gemini chat is an "a2a-server" session
// (Gemini driven by another tool over the Agent-to-Agent protocol) with no
// typed replies, so those are treated as automated background runs.
// =============================================================================

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { geminiHome, isDir, listFiles } from "../lib/paths.ts";
import { parseJson, readLineBuffers } from "../lib/lines.ts";
import { readJsonFile } from "../lib/files.ts";
import { toMs } from "../lib/time.ts";
import { warn, errMsg } from "../lib/log.ts";
import { categorize, categorizeCommand } from "./tool-categories.ts";
import { newSession, type AgentAdapter, type DateRange, type Session } from "./types.ts";

const tmpDir = () => path.join(geminiHome(), "tmp");
const isChat = (name: string) => name.startsWith("session-") && /\.jsonl?$/.test(name);
const MAX_JSON_BYTES = 200 * 1024 * 1024; // old .json chats must be parsed whole; refuse absurd sizes

export const gemini: AgentAdapter = {
  id: "gemini",

  async detect() {
    if (!isDir(tmpDir())) return { found: false, paths: [], note: "no ~/.gemini/tmp folder" };
    const chats = chatFiles();
    return chats.length
      ? { found: true, paths: [tmpDir()], note: `${chats.length} chat files` }
      : { found: false, paths: [tmpDir()], note: "folder exists but has no saved chats" };
  },

  async *collect(range: DateRange) {
    const fromMs = Date.parse(range.from + "T00:00:00Z") - 86400000;
    const folders = projectFolders();
    for (const file of chatFiles()) {
      try {
        if (fs.statSync(file).mtimeMs < fromMs) continue;
        const s = file.endsWith(".jsonl") ? await readJsonl(file) : readJson(file);
        if (!s) continue;
        // Folder name under tmp/ is the project name (new) or a path hash (old).
        const projectKey = path.basename(path.dirname(path.dirname(file)));
        s.cwd = folders.get(projectKey) ?? s.cwd ?? null;
        yield s;
      } catch (e) {
        warn(`Gemini CLI: skipped one chat (${errMsg(e)})`);
      }
    }
  },
};

const chatFiles = () =>
  listFiles(tmpDir(), isChat, 4).filter((f) => path.basename(path.dirname(f)) === "chats");

/**
 * projects.json → map of "<name or sha256 hash>" → project path, so a chat
 * folder can be traced back to the real project folder.
 */
function projectFolders(): Map<string, string> {
  const map = new Map<string, string>();
  const json = readJsonFile<any>(path.join(geminiHome(), "projects.json"), {});
  const projects = json?.projects && typeof json.projects === "object" ? json.projects : {};
  for (const [folder, name] of Object.entries(projects)) {
    if (typeof name === "string") map.set(name, folder);
    map.set(crypto.createHash("sha256").update(folder).digest("hex"), folder);
  }
  return map;
}

type GeminiMessage = Record<string, any>;

/** Newer patch-log format: stream lines, keep the latest copy of each message. */
async function readJsonl(file: string): Promise<Session | null> {
  const byId = new Map<string, GeminiMessage>();
  let header: any = null;
  let anon = 0;
  const take = (m: any) => {
    if (m && typeof m === "object" && m.type) byId.set(String(m.id ?? `anon-${anon++}`), m);
  };
  const takeAll = (v: any) => {
    if (Array.isArray(v)) v.forEach(take);
    else if (v && Array.isArray(v.$each)) v.$each.forEach(take);
    else take(v);
  };
  for await (const line of readLineBuffers(file)) {
    const r = parseJson(line);
    if (!r) continue;
    if (!header && (r.sessionId || r.projectHash)) header = r;
    if (Array.isArray(r.messages)) r.messages.forEach(take);
    if (r.$set?.messages) takeAll(r.$set.messages);
    if (r.$push?.messages) takeAll(r.$push.messages);
    if (r.id && r.type && r.timestamp && !r.$set) take(r); // a bare message line
  }
  return toSession(file, header ?? {}, [...byId.values()]);
}

/** Older single-object format. */
function readJson(file: string): Session | null {
  if (fs.statSync(file).size > MAX_JSON_BYTES) {
    warn(`Gemini CLI: skipped an oversized chat file`);
    return null;
  }
  const obj = readJsonFile<any>(file, null);
  if (!obj) return null;
  return toSession(file, obj, Array.isArray(obj.messages) ? obj.messages : []);
}

function toSession(file: string, header: any, messages: GeminiMessage[]): Session | null {
  const s = newSession("gemini", String(header.sessionId ?? path.basename(file)), file);
  for (const m of messages) {
    const at = toMs(m.timestamp);
    if (at === null) continue;
    if (m.type === "user") {
      const text = contentText(m.content);
      if (text) s.messages.push({ role: "user", at, text });
    } else if (m.type === "gemini" || m.type === "model") {
      const model = String(m.model ?? "gemini");
      s.messages.push({ role: "assistant", at, model });
      s.models[model] = (s.models[model] ?? 0) + 1;
      if (m.tokens) s.usage.push({ at, tokensIn: Number(m.tokens.input ?? 0), tokensOut: Number(m.tokens.output ?? 0), model });
      for (const call of Array.isArray(m.toolCalls) ? m.toolCalls : []) {
        const name = String(call?.name ?? "unknown");
        const category = name === "run_shell_command" ? categorizeCommand(call?.args?.command) : categorize(name);
        s.toolCalls.push({ at: toMs(call?.timestamp) ?? at, name, category });
      }
    }
  }
  if (!s.messages.length) return null;
  const a2a = header.sessionId === "a2a-server" || /a2a/.test(path.basename(file));
  const hasReply = s.messages.some((m) => m.role === "assistant");
  if (a2a || !hasReply) {
    s.origin = "automated";
    s.automatedKind = "other";
  }
  return s;
}

function contentText(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p: any) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : "")).join("\n");
  return "";
}
