// =============================================================================
// sources/tool-categories.ts — map every agent's tool names to shared buckets.
//
// The video says "Edit files" / "Run commands" / "Read files" / "Search"
// instead of Claude Code's "Edit" or Codex's "apply_patch", so a recap mixing
// several agents still reads naturally. The names below come from real logs on
// the developer's machine (Oct 2026) plus each agent's documented tools.
// =============================================================================

import type { ToolCategory } from "./types.ts";

/** Exact (lower-cased) tool name → bucket. Shared by all agents. */
const BY_NAME: Record<string, ToolCategory> = {
  // --- editing files ---
  edit: "edit", multiedit: "edit", write: "edit", notebookedit: "edit",
  apply_patch: "edit", patch: "edit", replace: "edit", write_file: "edit",
  str_replace: "edit", create_file: "edit", edit_file: "edit",
  // --- running commands ---
  bash: "run", shell: "run", local_shell: "run", run_shell_command: "run",
  exec_command: "run", write_stdin: "run", powershell: "run", run_terminal_cmd: "run",
  // --- reading ---
  read: "read", read_file: "read", read_many_files: "read", view: "read",
  view_image: "read", notebookread: "read",
  // --- searching ---
  grep: "search", glob: "search", ls: "search", list: "search", list_directory: "search",
  search_file_content: "search", codebase_search: "search", file_search: "search",
  tool_search: "search", toolsearch: "search",
  // --- web ---
  webfetch: "web", websearch: "web", web_fetch: "web", google_web_search: "web",
  web_search: "web", web_search_call: "web", web__run: "web",
  js: "web", // Codex's "js" tool drives its built-in browser (tab.goto, tab.url ...)
  // --- delegating to helper agents ---
  task: "delegate", agent: "delegate", spawn_agent: "delegate", send_message: "delegate",
  wait_agent: "delegate", followup_task: "delegate", subagenthandback: "delegate",
  // --- planning / to-dos ---
  todowrite: "plan", todoread: "plan", update_plan: "plan", enterplanmode: "plan",
  exitplanmode: "plan", save_memory: "plan",
};

/** Map a tool name (any agent) to its bucket. */
export function categorize(name: string): ToolCategory {
  const n = name.toLowerCase();
  if (BY_NAME[n]) return BY_NAME[n];
  // Check what a tool DOES before checking that it's an MCP tool: browser
  // automation is "web", driving a simulator/terminal is "run".
  if (n.includes("browser") || n.includes("chrome") || n.includes("playwright")) return "web";
  if (n.includes("simulator") || n.includes("emulator") || n.includes("terminal") || n.includes("preview_")) return "run";
  // Everything else exposed through MCP ("mcp__server__tool") is a connected app.
  if ((n.startsWith("mcp__") || n.startsWith("mcp_")) && !n.startsWith("mcp__ccd_")) return "mcp";
  return "other";
}

// Shell commands are the most common "tool" for Codex (`exec_command`), and a
// lot of them are really reads ("sed -n", "cat") or searches ("rg", "find").
// Splitting them makes Codex comparable with agents that have dedicated Read
// and Search tools.
const READ_CMDS = new Set(["cat", "sed", "nl", "head", "tail", "less", "more", "bat", "wc", "file", "stat", "jq", "od", "xxd"]);
const SEARCH_CMDS = new Set(["rg", "grep", "egrep", "fgrep", "ag", "ack", "find", "fd", "ls", "tree", "locate", "which", "glob"]);

/** Classify a shell command line by its first word (after env vars / sudo / cd &&). */
export function categorizeCommand(cmd: string | string[] | undefined): ToolCategory {
  let line = Array.isArray(cmd) ? cmd.join(" ") : (cmd ?? "");
  // `bash -lc "rg foo"` → look inside the quoted script.
  const inner = line.match(/^\s*(?:ba|z)?sh\s+-l?c\s+["']?([\s\S]*)$/);
  if (inner) line = inner[1];
  // Skip leading "cd x &&", env assignments and sudo.
  line = line.replace(/^\s*cd\s+[^;&|]+(?:&&|;)\s*/, "");
  const words = line.trim().split(/\s+/).filter((w) => !/^[A-Z_][A-Z0-9_]*=/.test(w) && w !== "sudo");
  const first = (words[0] ?? "").replace(/^.*\//, "");
  if (READ_CMDS.has(first)) return first === "sed" && !/\s-n\b/.test(line) ? "edit" : "read";
  if (SEARCH_CMDS.has(first)) return "search";
  return "run";
}
