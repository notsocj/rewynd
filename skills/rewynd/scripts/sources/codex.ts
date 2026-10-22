// =============================================================================
// sources/codex.ts — read Codex (CLI / IDE extension / app) rollouts, read-only.
//
// Where:  ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl      (older)
//         ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl.zst  (newer, zstd-compressed)
//         ~/.codex/archived_sessions/...                    (sessions you archived)
//         ($CODEX_HOME replaces ~/.codex)
// Format (verified on Codex 0.133–0.160, Oct 2026), one record per line:
//   { timestamp, type: "session_meta",  payload: { id, cwd, thread_source, source, ... } }
//   { timestamp, type: "turn_context",  payload: { model, ... } }
//   { timestamp, type: "response_item", payload: { type: "message" | "function_call" | "custom_tool_call" | ..._output ... } }
//   { timestamp, type: "event_msg",     payload: { type: "token_count" | "user_message" | ... } }
//
// Two things matter a lot:
//  1. SIZE. Single files reach ~700 MB. We stream, sniff each line's type from
//     its first bytes, and only JSON-parse the lines we need.
//  2. WHO STARTED IT. On the developer's machine ~80% of rollouts are automatic:
//     "guardian_review" (Codex reviewing its own work) and sub-agents. Those
//     are marked automated, so they never inflate "sessions you started".
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { codexHome, isDir, listFiles } from "../lib/paths.ts";
import { head, parseJson, readLineBuffers } from "../lib/lines.ts";
import { toMs } from "../lib/time.ts";
import { warn, errMsg } from "../lib/log.ts";
import { categorize, categorizeCommand } from "./tool-categories.ts";
import { newSession, type AgentAdapter, type DateRange, type Session, type AutomatedKind } from "./types.ts";

const isRollout = (name: string) => name.startsWith("rollout-") && /\.jsonl(\.zst)?$/.test(name);
const roots = () => [path.join(codexHome(), "sessions"), path.join(codexHome(), "archived_sessions")];

// "User" messages Codex injects itself (environment info, AGENTS.md, ...).
const INJECTED = /^\s*(<environment_context>|<user_instructions>|<permissions|<INSTRUCTIONS>|<turn_aborted>|<user_shell_command>|<collaboration_mode>|# AGENTS\.md instructions|<subagent_notification>)/;
// `git commit` prints "[branch abc1234] message": lets us match commits exactly (§20).
const COMMIT_OUT = /\[([\w./-]+)(?: \(root-commit\))? ([0-9a-f]{7,40})\] /g;
const SHELL_TOOLS = new Set(["exec_command", "shell", "local_shell", "container.exec", "shell_command"]);

export const codex: AgentAdapter = {
  id: "codex",

  async detect() {
    const dirs = roots().filter(isDir);
    if (!dirs.length) return { found: false, paths: [], note: "no ~/.codex/sessions folder" };
    const n = dirs.reduce((acc, d) => acc + listFiles(d, isRollout).length, 0);
    return n
      ? { found: true, paths: dirs, note: `${n} rollout files` }
      : { found: false, paths: dirs, note: "folder exists but has no rollouts" };
  },

  async *collect(range: DateRange) {
    const fromMs = Date.parse(range.from + "T00:00:00Z") - 86400000;
    const seen = new Set<string>(); // the same session can exist in sessions/ and archived_sessions/
    for (const dir of roots().filter(isDir)) {
      for (const file of listFiles(dir, isRollout)) {
        try {
          if (fs.statSync(file).mtimeMs < fromMs) continue;
        } catch {
          continue;
        }
        try {
          const s = await readRollout(file);
          if (!s || seen.has(s.id)) continue;
          seen.add(s.id);
          yield s;
        } catch (e) {
          // A rollout still being written can end mid-zstd-frame: skip it, keep going.
          warn(`Codex: skipped one rollout (${errMsg(e)})`);
        }
      }
    }
  },
};

async function readRollout(file: string): Promise<Session | null> {
  const s = newSession("codex", path.basename(file).replace(/\.jsonl(\.zst)?$/, ""), file);
  let model = "unknown";
  let sawMeta = false;
  let prevTotal = { in: 0, out: 0 };
  // Newer Codex logs your typed text as event_msg/user_message AND as a
  // response_item message. Prefer the event list when present (no injected text).
  const fromEvents: { at: number; text: string }[] = [];
  const fromItems: { at: number; text: string }[] = [];

  for await (const line of readLineBuffers(file)) {
    const h = head(line, 220);
    const top = h.match(/"type":"(session_meta|turn_context|response_item|event_msg)"/)?.[1];
    if (!top) continue;
    const sub = h.match(/"payload":\{"type":"([a-z_]+)"/)?.[1];

    // Tool OUTPUT lines are the heavy ones. We only peek for commit hashes.
    if (top === "response_item" && sub && sub.endsWith("_output")) {
      if (line.length < 300_000 && line.includes("] ")) {
        for (const m of line.toString("utf8").matchAll(COMMIT_OUT)) s.commitHashes.push(m[2]);
      }
      continue;
    }
    if (top === "response_item" && !["message", "function_call", "custom_tool_call", "local_shell_call", "web_search_call", "tool_search_call"].includes(sub ?? "")) continue;
    if (top === "event_msg" && sub !== "token_count" && sub !== "user_message") continue;

    const r = parseJson(line);
    if (!r) continue;
    const at = toMs(r.timestamp);
    const p = r.payload ?? {};

    if (top === "session_meta") {
      if (sawMeta) continue; // forks repeat the parent's meta: the first one is this session
      sawMeta = true;
      if (p.id) s.id = String(p.id);
      if (typeof p.cwd === "string") s.cwd = p.cwd;
      const kind = automatedKind(p);
      if (kind) {
        s.origin = "automated";
        s.automatedKind = kind;
      }
      continue;
    }
    if (at === null) continue;
    if (top === "turn_context") {
      if (p.model) model = String(p.model);
      continue;
    }
    if (top === "event_msg") {
      if (sub === "user_message" && typeof p.message === "string") {
        fromEvents.push({ at, text: p.message });
      } else if (sub === "token_count") {
        // Codex reports a running TOTAL; we store the increase since last time.
        const t = p.info?.total_token_usage;
        if (t) {
          const now = { in: t.input_tokens ?? 0, out: t.output_tokens ?? 0 };
          const dIn = now.in >= prevTotal.in ? now.in - prevTotal.in : now.in; // reset = new context
          const dOut = now.out >= prevTotal.out ? now.out - prevTotal.out : now.out;
          prevTotal = now;
          if (dIn || dOut) s.usage.push({ at, tokensIn: dIn, tokensOut: dOut, model });
        }
      }
      continue;
    }

    // response_item
    if (sub === "message") {
      if (p.role === "user") {
        const text = (Array.isArray(p.content) ? p.content : [])
          .filter((c: any) => typeof c?.text === "string")
          .map((c: any) => c.text)
          .join("\n");
        if (text && !INJECTED.test(text)) fromItems.push({ at, text });
      } else if (p.role === "assistant") {
        s.messages.push({ role: "assistant", at, model });
        s.models[model] = (s.models[model] ?? 0) + 1;
      }
    } else if (sub === "function_call") {
      const name = String(p.name ?? "unknown");
      let category = categorize(name);
      if (SHELL_TOOLS.has(name)) {
        const args = parseJson(String(p.arguments ?? "{}")) ?? {};
        category = categorizeCommand(args.cmd ?? args.command);
      }
      s.toolCalls.push({ at, name, category });
    } else if (sub === "custom_tool_call") {
      const name = String(p.name ?? "unknown");
      if (name === "exec" && typeof p.input === "string") {
        // Newer Codex "code mode": one `exec` call is a small JS program that
        // calls the real tools (tools.exec_command, tools.apply_patch, ...).
        // Count those inner calls, so Codex is comparable with other agents.
        const inner = innerToolCalls(p.input);
        if (inner.length) inner.forEach((c) => s.toolCalls.push({ at, ...c }));
        else s.toolCalls.push({ at, name, category: "run" });
      } else {
        s.toolCalls.push({ at, name, category: categorize(name) });
      }
    } else if (sub === "local_shell_call") {
      s.toolCalls.push({ at, name: "local_shell", category: categorizeCommand(p.action?.command) });
    } else if (sub === "web_search_call") {
      s.toolCalls.push({ at, name: "web_search", category: "web" });
    } else if (sub === "tool_search_call") {
      s.toolCalls.push({ at, name: "tool_search", category: "search" });
    }
  }

  for (const m of fromEvents.length ? fromEvents : fromItems) s.messages.push({ role: "user", at: m.at, text: m.text });
  if (!s.messages.length && !s.toolCalls.length && !s.usage.length) return null;
  // A "user" session where nobody actually typed anything is not yours either.
  if (s.origin === "human" && !s.messages.some((m) => m.role === "user")) {
    s.origin = "automated";
    s.automatedKind = "other";
  }
  return s;
}

/** Tool calls inside a Codex `exec` script, e.g. tools.exec_command({cmd: "rg foo"}). */
function innerToolCalls(code: string): { name: string; category: ReturnType<typeof categorize> }[] {
  const out: { name: string; category: ReturnType<typeof categorize> }[] = [];
  // The argument text is captured inside a lookahead, so it isn't consumed and
  // the next `tools.x(` call in the same script is still found.
  for (const m of code.matchAll(/tools\.([A-Za-z_]+)\s*\((?=([\s\S]{0,400}))/g)) {
    const name = m[1];
    if (SHELL_TOOLS.has(name)) {
      // A backslash always pairs with the next character, and a plain character
      // can never be a backslash, so there's exactly ONE way to match
      // (an ambiguous pattern here backtracked exponentially on real logs).
      const cmd = m[2].match(/\b(?:cmd|command)\s*:\s*(["'`])((?:\\[\s\S]|(?!\1)[^\\])*)\1/)?.[2];
      out.push({ name, category: categorizeCommand(cmd) });
    } else out.push({ name, category: categorize(name) });
  }
  return out;
}

/** Decide from session_meta whether Codex started this session by itself. */
function automatedKind(meta: any): AutomatedKind | null {
  const ts = meta.thread_source;
  const src = meta.source;
  if (ts === "guardian_review") return "review";
  if (src && typeof src === "object" && src.subagent) {
    const sa = src.subagent;
    return sa?.other === "guardian" || sa === "review" ? "review" : "subagent";
  }
  if (ts === "subagent") return "subagent";
  return null; // "user", "chatgpt_handoff", "realtime_voice", older files with no thread_source
}
