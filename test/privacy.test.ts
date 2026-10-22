// Privacy guarantees that must never regress:
//   1. no network code outside scripts/shipped/github.ts (and that file only
//      talks through the `gh` CLI)
//   2. nothing writes into an agent's folders
//   3. data/ and output/ are git-ignored

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { listFiles, REWYND_ROOT } from "../scripts/lib/paths.ts";

const scriptFiles = listFiles(path.join(REWYND_ROOT, "scripts"), (f) => f.endsWith(".ts"));

test("no network APIs in scripts/ (GitHub goes through the gh CLI only)", () => {
  const banned = /\bfetch\s*\(|from\s+["']node:(https?|net|tls|dgram|http2)["']|require\(["'](https?|net)["']\)|XMLHttpRequest|WebSocket|new\s+URL\([^)]*http/;
  for (const f of scriptFiles) {
    const src = fs.readFileSync(f, "utf8");
    assert.ok(!banned.test(src), `network code found in ${path.relative(REWYND_ROOT, f)}`);
  }
});

test("only rewynd's own files are ever written", () => {
  // Writes go through lib/files.ts (writeJsonAtomic → data/ and output/), plus
  // render.ts copying a user's font/music INTO video/public. Nothing else may
  // call a write API.
  const writers = /\b(writeFileSync|appendFileSync|renameSync|unlinkSync|rmSync|copyFileSync|createWriteStream|mkdirSync)\b/;
  const allowed = new Set(["lib/files.ts", "render/render.ts", "migrate.ts"]);
  for (const f of scriptFiles) {
    const rel = path.relative(path.join(REWYND_ROOT, "scripts"), f);
    if (allowed.has(rel)) continue;
    assert.ok(!writers.test(fs.readFileSync(f, "utf8")), `${rel} writes files; route writes through lib/files.ts`);
  }
});

test("data/ and output/ are git-ignored", () => {
  const ignore = fs.readFileSync(path.join(REWYND_ROOT, ".gitignore"), "utf8").split("\n").map((l) => l.trim());
  assert.ok(ignore.includes("data/"));
  assert.ok(ignore.includes("output/"));
});
