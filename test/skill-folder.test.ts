// `npx skills add https://github.com/notsocj/rewynd --skill rewynd` copies ONLY
// the skills/rewynd/ folder. These tests keep that folder installable on its
// own: no file inside it may import anything outside it, and the SKILL.md
// must match what the skills CLI expects.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { listFiles, REWYND_ROOT, REPO_ROOT } from "../skills/rewynd/scripts/lib/paths.ts";

const sources = listFiles(REWYND_ROOT, (f) => /\.(ts|tsx)$/.test(f), 12).filter((f) => !f.includes(`${path.sep}node_modules${path.sep}`));

test("every relative import stays inside the skill folder", () => {
  assert.ok(sources.length > 50, "found the skill's source files");
  const spec = /(?:import|export)[^'"]*?from\s*["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
  for (const file of sources) {
    for (const m of fs.readFileSync(file, "utf8").matchAll(spec)) {
      const target = path.resolve(path.dirname(file), m[1] ?? m[2]);
      assert.ok(
        target.startsWith(REWYND_ROOT + path.sep),
        `${path.relative(REWYND_ROOT, file)} imports ${m[1] ?? m[2]}, which is outside skills/rewynd/`,
      );
    }
  }
});

test("SKILL.md frontmatter matches the folder name, and has its own package.json", () => {
  const skill = fs.readFileSync(path.join(REWYND_ROOT, "SKILL.md"), "utf8");
  const name = skill.match(/^---\n[\s\S]*?^name:\s*(\S+)/m)?.[1];
  assert.equal(name, path.basename(REWYND_ROOT));
  assert.match(skill, /^description:\s*\S/m);
  // Node needs "type": "module" next to the .ts files once the folder is copied alone.
  const pkg = JSON.parse(fs.readFileSync(path.join(REWYND_ROOT, "package.json"), "utf8"));
  assert.equal(pkg.type, "module");
});

test("in the repo, data lives at the repo root (not inside the skill folder)", () => {
  assert.ok(REPO_ROOT, "running from a git clone");
  assert.equal(path.resolve(REWYND_ROOT, "..", ".."), REPO_ROOT);
});
