// =============================================================================
// sources/later.ts — agents rewynd can DETECT but doesn't read yet.
//
// Cursor and Antigravity are on the "later / optional" list (rewynd-context.md
// §18). Their history lives in undocumented SQLite databases that change when
// the app updates (Cursor's can be ~1.5 GB), so reading them needs real test
// data first. For now we only detect them, so /rewynd status can say
// "Cursor found, support coming later" instead of silently ignoring it.
// Their collect() yields nothing.
// =============================================================================

import path from "node:path";
import { appSupportDir, exists, geminiHome, isDir, listFiles } from "../lib/paths.ts";
import type { AgentAdapter } from "./types.ts";

const LATER_NOTE = "found, but reading it isn't supported yet (planned for a later version)";

export const cursor: AgentAdapter = {
  id: "cursor",
  async detect() {
    const db = path.join(appSupportDir(), "Cursor", "User", "globalStorage", "state.vscdb");
    return exists(db)
      ? { found: true, supported: false, paths: [db], note: LATER_NOTE }
      : { found: false, paths: [], note: "Cursor isn't installed" };
  },
  async *collect() {},
};

export const antigravity: AgentAdapter = {
  id: "antigravity",
  async detect() {
    const dir = path.join(geminiHome(), "antigravity", "conversations");
    const n = isDir(dir) ? listFiles(dir, (f) => f.endsWith(".db"), 1).length : 0;
    return n
      ? { found: true, supported: false, paths: [dir], note: `${n} conversations ${LATER_NOTE}` }
      : { found: false, paths: [], note: "Antigravity isn't installed" };
  },
  async *collect() {},
};
