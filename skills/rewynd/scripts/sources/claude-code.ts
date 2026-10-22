// =============================================================================
// sources/claude-code.ts — read Claude Code's local transcripts (read-only).
//
// Where:  ~/.claude/projects/<folder-slug>/<session-id>.jsonl
//         ~/.claude/projects/<folder-slug>/<session-id>/subagents/*.jsonl
//         ($CLAUDE_CONFIG_DIR replaces ~/.claude)
// Format: one JSON record per line. Verified on Claude Code 2.1.x (Oct 2026):
//   type "user"       → { message: { role, content }, origin: { kind: "human" }, cwd, timestamp, isMeta?, isSidechain? }
//                        (tool results ALSO arrive as "user" records, with tool_result blocks)
//   type "assistant"  → { message: { id, model, content: [...blocks], usage: {...} }, timestamp }
//                        (one reply is split across several records sharing message.id)
//   plus bookkeeping types we ignore: attachment, system, queue-operation,
//   custom-title, agent-name, file-history-snapshot, last-prompt...
//
// Claude Code deletes transcripts after `cleanupPeriodDays` (default 30).
// rewynd never changes that setting. It saves daily totals instead (§19).
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { claudeHome, isDir, listFiles } from "../lib/paths.ts";
import { head, parseJson, readLineBuffers } from "../lib/lines.ts";
import { toMs } from "../lib/time.ts";
import { warn, errMsg } from "../lib/log.ts";
import { categorize, categorizeCommand } from "./tool-categories.ts";
import { newSession, type AgentAdapter, type DateRange, type Session } from "./types.ts";
import { typedText } from "./user-text.ts";

const projectsDir = () => path.join(claudeHome(), "projects");

// Text that Claude Code injects as a "user" message but that you didn't type.
const INJECTED = /^\s*(<system-reminder>|<local-command-stdout>|<local-command-stderr>|<command-message>|<task-notification>|<user-prompt-submit-hook>|Caveat: The messages below|\[Request interrupted)/;

export const claudeCode: AgentAdapter = {
  id: "claude-code",

  async detect() {
    const dir = projectsDir();
    if (!isDir(dir)) return { found: false, paths: [], note: "no ~/.claude/projects folder" };
    const n = listFiles(dir, (f) => f.endsWith(".jsonl")).length;
    return n
      ? { found: true, paths: [dir], note: `${n} transcript files` }
      : { found: false, paths: [dir], note: "folder exists but has no transcripts" };
  },

  async *collect(range: DateRange) {
    const fromMs = Date.parse(range.from + "T00:00:00Z") - 86400000; // 1 day slack for timezones
    for (const file of listFiles(projectsDir(), (f) => f.endsWith(".jsonl"))) {
      // A file last written before the range can't contain anything in it.
      try {
        if (fs.statSync(file).mtimeMs < fromMs) continue;
      } catch {
        continue;
      }
      try {
        const s = await readSession(file);
        if (s) yield s;
      } catch (e) {
        warn(`Claude Code: skipped one transcript (${errMsg(e)})`);
      }
    }
  },
};

async function readSession(file: string): Promise<Session | null> {
  const s = newSession("claude-code", path.basename(file, ".jsonl"), file);
  const isSubagentFile = file.split(path.sep).includes("subagents");
  const seenReplies = new Set<string>(); // message.id already counted
  const seenTools = new Set<string>(); // tool_use id already counted
  let humanMessages = 0;
  let sidechainOnly = true;

  for await (const line of readLineBuffers(file)) {
    const h = head(line, 500);
    const isUser = h.includes('"type":"user"');
    const isAssistant = h.includes('"role":"assistant"');
    if (!isUser && !isAssistant) continue; // bookkeeping record
    // Tool results are "user" records too; they can be huge and we don't need them.
    if (isUser && (h.includes('"tool_use_id"') || h.includes('"type":"tool_result"'))) continue;

    const r = parseJson(line);
    if (!r) continue;
    const at = toMs(r.timestamp);
    if (at === null) continue;
    if (!s.cwd && typeof r.cwd === "string") s.cwd = r.cwd;
    if (!r.isSidechain) sidechainOnly = false;

    if (r.type === "user") {
      if (r.isMeta) continue;
      // Sub-agent prompts are written by the main agent, not you: keep the
      // event (so the background run is counted) but it isn't a human message.
      if (r.isSidechain) {
        s.messages.push({ role: "user", at });
        continue;
      }
      // Newer versions say who wrote it. Anything not "human" (hooks, tasks...) isn't you.
      if (r.origin?.kind && r.origin.kind !== "human") continue;
      const text = userText(r.message?.content);
      if (text === null) continue; // only tool results / images
      if (INJECTED.test(text)) continue;
      // Slash commands ("<command-name>/foo") are you, but there's no prose to count.
      const typed = text.trimStart().startsWith("<command-name>") ? "" : typedText(text);
      if (typed === null) continue; // the app wrote all of it
      s.messages.push({ role: "user", at, text: typed });
      humanMessages++;
    } else if (r.type === "assistant" && r.message) {
      const m = r.message;
      const replyId: string = m.id ?? r.uuid;
      if (!seenReplies.has(replyId)) {
        seenReplies.add(replyId);
        if (m.model && m.model !== "<synthetic>") {
          s.messages.push({ role: "assistant", at, model: m.model });
          s.models[m.model] = (s.models[m.model] ?? 0) + 1;
          const u = m.usage ?? {};
          s.usage.push({
            at,
            // Count everything sent to the model, including cached context.
            tokensIn: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
            tokensOut: u.output_tokens ?? 0,
            model: m.model,
          });
        }
      }
      for (const block of Array.isArray(m.content) ? m.content : []) {
        if (block?.type !== "tool_use" || seenTools.has(block.id)) continue;
        seenTools.add(block.id);
        const name = String(block.name ?? "unknown");
        // Bash is Claude Code's biggest tool; split reads/searches out like we do for Codex.
        const category = name === "Bash" ? categorizeCommand(block.input?.command) : categorize(name);
        s.toolCalls.push({ at, name, category });
      }
    }
  }

  if (!s.messages.length && !s.toolCalls.length) return null;
  if (isSubagentFile || sidechainOnly) {
    s.origin = "automated";
    s.automatedKind = "subagent";
  } else if (humanMessages === 0) {
    // e.g. scripted SDK runs: Claude worked, but nobody typed.
    s.origin = "automated";
    s.automatedKind = "other";
  }
  return s;
}

/** Plain text of a user message, or null if it has no text (tool results only). */
function userText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const texts = content.filter((b: any) => b?.type === "text" && typeof b.text === "string").map((b: any) => b.text);
  return texts.length ? texts.join("\n") : null;
}
