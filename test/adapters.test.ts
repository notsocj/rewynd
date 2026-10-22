// Every adapter, on synthetic data shaped like the real formats (see the
// comments at the top of each scripts/sources/*.ts file). Env overrides point
// the adapters at temp folders, so your real history is never touched.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { claudeCode } from "../skills/rewynd/scripts/sources/claude-code.ts";
import { codex } from "../skills/rewynd/scripts/sources/codex.ts";
import { gemini } from "../skills/rewynd/scripts/sources/gemini.ts";
import { opencode } from "../skills/rewynd/scripts/sources/opencode.ts";
import { all, tempDir, writeJson, writeJsonl } from "./helpers.ts";

const RANGE = { from: "1970-01-01", to: "2100-01-01" };

test("Claude Code: human messages, deduped replies, tools, tokens, sub-agents", async () => {
  const home = tempDir();
  process.env.CLAUDE_CONFIG_DIR = home;
  const proj = path.join(home, "projects", "-tmp-lumen");
  const base = { sessionId: "s1", cwd: "/tmp/lumen", version: "2.1.286" };
  writeJsonl(path.join(proj, "s1.jsonl"), [
    { type: "queue-operation", operation: "enqueue", timestamp: "2026-10-21T01:00:00Z" },
    { ...base, type: "user", timestamp: "2026-10-21T01:00:00Z", origin: { kind: "human" }, message: { role: "user", content: "please fix it, still broken" } },
    { ...base, type: "user", timestamp: "2026-10-21T01:00:01Z", isMeta: true, message: { role: "user", content: "<system-reminder>x</system-reminder>" } },
    // One reply split over two records with the same message.id → counted once.
    { ...base, type: "assistant", timestamp: "2026-10-21T01:00:05Z", message: { id: "m1", model: "claude-opus-5-5", role: "assistant", content: [{ type: "thinking", thinking: "" }], usage: { input_tokens: 10, cache_read_input_tokens: 90, output_tokens: 5 } } },
    { ...base, type: "assistant", timestamp: "2026-10-21T01:00:06Z", message: { id: "m1", model: "claude-opus-5-5", role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "rg foo" } }], usage: { input_tokens: 10, output_tokens: 5 } } },
    { ...base, type: "user", timestamp: "2026-10-21T01:00:07Z", message: { role: "user", content: [{ tool_use_id: "t1", type: "tool_result", content: "out" }] } },
    { ...base, type: "assistant", timestamp: "2026-10-21T01:00:09Z", message: { id: "m2", model: "claude-opus-5-5", role: "assistant", content: [{ type: "tool_use", id: "t2", name: "Edit", input: {} }], usage: { input_tokens: 1, output_tokens: 1 } } },
  ]);
  writeJsonl(path.join(proj, "s1", "subagents", "agent-1.jsonl"), [
    { ...base, type: "user", isSidechain: true, timestamp: "2026-10-21T01:01:00Z", message: { role: "user", content: "sub task" } },
  ]);
  const sessions = await all(claudeCode.collect(RANGE));
  const main = sessions.find((s) => s.id === "s1")!;
  assert.equal(main.origin, "human");
  assert.equal(main.cwd, "/tmp/lumen");
  assert.equal(main.messages.filter((m) => m.role === "user").length, 1);
  assert.equal(main.messages.filter((m) => m.role === "assistant").length, 2);
  assert.deepEqual(main.toolCalls.map((t) => t.category), ["search", "edit"]);
  assert.equal(main.usage[0].tokensIn, 100); // input + cache read
  const sub = sessions.find((s) => s.id === "agent-1")!;
  assert.equal(sub.origin, "automated");
  assert.equal(sub.automatedKind, "subagent");
  delete process.env.CLAUDE_CONFIG_DIR;
});

test("Codex: plain + zstd rollouts, guardian reviews, exec code-mode tools, token deltas, commit hashes", async () => {
  const home = tempDir();
  process.env.CODEX_HOME = home;
  const day = path.join(home, "sessions", "2026", "10", "21");
  const human = [
    { timestamp: "2026-10-21T02:00:00Z", type: "session_meta", payload: { id: "c1", cwd: "/tmp/lumen", thread_source: "user", source: "vscode" } },
    { timestamp: "2026-10-21T02:00:00Z", type: "turn_context", payload: { model: "gpt-6.1-sol" } },
    { timestamp: "2026-10-21T02:00:01Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>cwd</environment_context>" }] } },
    { timestamp: "2026-10-21T02:00:02Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "why is the login  broken" }] } },
    { timestamp: "2026-10-21T02:00:03Z", type: "response_item", payload: { type: "function_call", name: "exec_command", arguments: JSON.stringify({ cmd: "sed -n 1,20p a.ts" }) } },
    { timestamp: "2026-10-21T02:00:04Z", type: "response_item", payload: { type: "custom_tool_call", name: "exec", input: 'const r = await tools.exec_command({cmd: "rg \\"login\\" src"}); await tools.apply_patch("*** Begin Patch");' } },
    { timestamp: "2026-10-21T02:00:05Z", type: "response_item", payload: { type: "function_call_output", output: "[main 1a2b3c4] Fix login\n 1 file changed" } },
    { timestamp: "2026-10-21T02:00:06Z", type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 100, output_tokens: 10 } } } },
    { timestamp: "2026-10-21T02:00:07Z", type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 250, output_tokens: 30 } } } },
    { timestamp: "2026-10-21T02:00:08Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "done" }] } },
  ];
  writeJsonl(path.join(day, "rollout-2026-10-21T02-00-00-c1.jsonl"), human);
  const review = [
    { timestamp: "2026-10-21T02:05:00Z", type: "session_meta", payload: { id: "g1", cwd: "/tmp/lumen", thread_source: "guardian_review", source: { subagent: { other: "guardian" } } } },
    { timestamp: "2026-10-21T02:05:01Z", type: "response_item", payload: { type: "message", role: "assistant", content: [] } },
  ];
  fs.writeFileSync(path.join(day, "rollout-2026-10-21T02-05-00-g1.jsonl.zst"), zlib.zstdCompressSync(Buffer.from(review.map((r) => JSON.stringify(r)).join("\n") + "\n")));

  const sessions = await all(codex.collect(RANGE));
  const c1 = sessions.find((s) => s.id === "c1")!;
  assert.equal(c1.origin, "human");
  assert.equal(c1.messages.filter((m) => m.role === "user").length, 1, "injected environment text is not a user message");
  assert.deepEqual(c1.toolCalls.map((t) => t.category), ["read", "search", "edit"]);
  assert.deepEqual(c1.usage.map((u) => [u.tokensIn, u.tokensOut]), [[100, 10], [150, 20]]);
  assert.deepEqual(c1.commitHashes, ["1a2b3c4"]);
  const g1 = sessions.find((s) => s.id === "g1")!;
  assert.equal(g1.origin, "automated");
  assert.equal(g1.automatedKind, "review");
  delete process.env.CODEX_HOME;
});

test("Gemini CLI: patch-log .jsonl and older .json chats; a2a sessions are background runs", async () => {
  const home = tempDir();
  process.env.GEMINI_DATA_DIR = home;
  writeJson(path.join(home, "projects.json"), { projects: { "/tmp/lumen": "lumen" } });
  writeJsonl(path.join(home, "tmp", "lumen", "chats", "session-2026-10-21T03-00-abc.jsonl"), [
    { sessionId: "abc", projectHash: "h", startTime: "2026-10-21T03:00:00Z", kind: "main" },
    { $set: { messages: [{ id: "u1", timestamp: "2026-10-21T03:00:01Z", type: "user", content: [{ text: "add tests please" }] }] } },
    { $set: { messages: [{ id: "g1", timestamp: "2026-10-21T03:00:05Z", type: "gemini", content: "ok", model: "gemini-3-pro", tokens: { input: 50, output: 7 }, toolCalls: [{ name: "run_shell_command", args: { command: "npm test" } }, { name: "read_file" }] }] } },
  ]);
  writeJson(path.join(home, "tmp", "deadbeef", "chats", "session-2026-10-20T03-00-old.json"), {
    sessionId: "old",
    projectHash: "deadbeef",
    messages: [
      { id: "1", timestamp: "2026-10-20T03:00:00Z", type: "user", content: "hello" },
      { id: "2", timestamp: "2026-10-20T03:00:02Z", type: "gemini", content: "hi" },
    ],
  });
  writeJsonl(path.join(home, "tmp", "lumen", "chats", "session-2026-06-20T09-06-a2a-serv.jsonl"), [
    { sessionId: "a2a-server", projectHash: "h", startTime: "2026-06-20T09:06:00Z", kind: "main" },
    { $set: { messages: [{ id: "x", timestamp: "2026-06-20T09:06:01Z", type: "user", content: [{ text: "long automated prompt" }] }] } },
  ]);
  const sessions = await all(gemini.collect(RANGE));
  const abc = sessions.find((s) => s.id === "abc")!;
  assert.equal(abc.origin, "human");
  assert.equal(abc.cwd, "/tmp/lumen");
  assert.deepEqual(abc.toolCalls.map((t) => t.category), ["run", "read"]);
  assert.equal(abc.usage[0].tokensIn, 50);
  assert.equal(sessions.find((s) => s.id === "old")!.origin, "human");
  assert.equal(sessions.find((s) => s.id === "a2a-server")!.origin, "automated");
  delete process.env.GEMINI_DATA_DIR;
});

test("OpenCode: SQLite database (read-only) and older JSON storage", async () => {
  const xdg = tempDir();
  process.env.XDG_DATA_HOME = xdg;
  const base = path.join(xdg, "opencode");
  fs.mkdirSync(base, { recursive: true });

  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(base, "opencode.db"));
  db.exec(`CREATE TABLE session (id TEXT, directory TEXT, parent_id TEXT, time_created INTEGER, time_updated INTEGER);
           CREATE TABLE message (id TEXT, session_id TEXT, time_created INTEGER, data TEXT);
           CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, data TEXT);`);
  const t = Date.parse("2026-10-21T04:00:00Z");
  db.prepare("INSERT INTO session VALUES (?,?,?,?,?)").run("ses1", "/tmp/lumen", null, t, t + 60000);
  db.prepare("INSERT INTO session VALUES (?,?,?,?,?)").run("ses2", "/tmp/lumen", "ses1", t, t + 60000);
  db.prepare("INSERT INTO message VALUES (?,?,?,?)").run("m1", "ses1", t, JSON.stringify({ role: "user", time: { created: t } }));
  db.prepare("INSERT INTO message VALUES (?,?,?,?)").run("m2", "ses1", t + 5000, JSON.stringify({ role: "assistant", modelID: "claude-sonnet-5-5", time: { created: t + 5000 }, tokens: { input: 20, output: 4, cache: { read: 80, write: 0 } } }));
  db.prepare("INSERT INTO message VALUES (?,?,?,?)").run("m3", "ses2", t + 6000, JSON.stringify({ role: "assistant", time: { created: t + 6000 } }));
  db.prepare("INSERT INTO part VALUES (?,?,?,?)").run("p1", "m1", "ses1", JSON.stringify({ type: "text", text: "thanks, fix it" }));
  db.prepare("INSERT INTO part VALUES (?,?,?,?)").run("p2", "m2", "ses1", JSON.stringify({ type: "tool", tool: "bash", state: { input: { command: "cat a.ts" } } }));
  db.close();

  writeJson(path.join(base, "storage", "session", "proj", "old1.json"), { id: "old1", directory: "/tmp/harbor", time: { created: t, updated: t } });
  writeJson(path.join(base, "storage", "message", "old1", "mA.json"), { id: "mA", role: "user", time: { created: t } });
  writeJson(path.join(base, "storage", "message", "old1", "mB.json"), { id: "mB", role: "assistant", modelID: "gpt-6", time: { created: t + 1000 }, tokens: { input: 1, output: 1 } });
  writeJson(path.join(base, "storage", "part", "mA", "pA.json"), { type: "text", text: "hello" });
  writeJson(path.join(base, "storage", "part", "mB", "pB.json"), { type: "tool", tool: "edit" });

  assert.equal((await opencode.detect()).found, true);
  const sessions = await all(opencode.collect(RANGE));
  const s1 = sessions.find((s) => s.id === "ses1")!;
  assert.equal(s1.origin, "human");
  assert.equal(s1.messages.find((m) => m.role === "user")!.text, "thanks, fix it");
  assert.deepEqual(s1.toolCalls.map((x) => x.category), ["read"]);
  assert.equal(s1.usage[0].tokensIn, 100);
  assert.equal(sessions.find((s) => s.id === "ses2")!.origin, "automated");
  const old = sessions.find((s) => s.id === "old1")!;
  assert.deepEqual(old.toolCalls.map((x) => x.category), ["edit"]);
  delete process.env.XDG_DATA_HOME;
});
