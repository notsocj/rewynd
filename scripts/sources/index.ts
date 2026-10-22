// =============================================================================
// sources/index.ts — the list of every agent adapter, plus detection.
//
// collect.ts never imports an adapter directly: it loops over ADAPTERS. To add
// an agent, write sources/<agent>.ts and add it here.
// =============================================================================

import { claudeCode } from "./claude-code.ts";
import { codex } from "./codex.ts";
import { gemini } from "./gemini.ts";
import { opencode } from "./opencode.ts";
import { cursor, antigravity } from "./later.ts";
import { errMsg } from "../lib/log.ts";
import type { AgentAdapter, AgentId, DetectResult } from "./types.ts";

export const ADAPTERS: AgentAdapter[] = [claudeCode, codex, gemini, opencode, cursor, antigravity];

export type Detection = { adapter: AgentAdapter; result: DetectResult };

/**
 * Run detect() for every adapter. A detector that throws is reported as
 * "not found" with the error as its note. One broken agent never stops the rest.
 */
export async function detectAll(only?: AgentId[]): Promise<Detection[]> {
  const out: Detection[] = [];
  for (const adapter of ADAPTERS) {
    if (only && !only.includes(adapter.id)) continue;
    try {
      out.push({ adapter, result: await adapter.detect() });
    } catch (e) {
      out.push({ adapter, result: { found: false, paths: [], note: `detection failed: ${errMsg(e)}` } });
    }
  }
  return out;
}
