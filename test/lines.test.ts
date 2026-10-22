// lib/lines.ts: JSONL must split on "\n" ONLY. Node's readline also splits on
// U+2028/U+2029, which appear inside real Codex messages; that bug is why
// rewynd has its own line reader.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { readLineBuffers, parseJson } from "../scripts/lib/lines.ts";
import { tempDir } from "./helpers.ts";

async function lines(file: string): Promise<string[]> {
  const out: string[] = [];
  for await (const b of readLineBuffers(file)) out.push(b.toString("utf8"));
  return out;
}

test("keeps U+2028 / U+2029 inside a JSON line", async () => {
  const dir = tempDir();
  const file = path.join(dir, "a.jsonl");
  const rec = { text: "line one line two end" };
  fs.writeFileSync(file, JSON.stringify(rec) + "\n" + JSON.stringify({ n: 2 }) + "\n");
  const got = await lines(file);
  assert.equal(got.length, 2);
  assert.deepEqual(parseJson(got[0]), rec);
});

test("handles CRLF, a missing final newline and empty lines", async () => {
  const dir = tempDir();
  const file = path.join(dir, "b.jsonl");
  fs.writeFileSync(file, '{"a":1}\r\n\r\n{"b":2}');
  assert.deepEqual(await lines(file), ['{"a":1}', '{"b":2}']);
});

test("reads zstd-compressed .jsonl.zst files", async () => {
  const dir = tempDir();
  const file = path.join(dir, "c.jsonl.zst");
  const body = Array.from({ length: 5000 }, (_, i) => JSON.stringify({ i, pad: "x".repeat(300) })).join("\n") + "\n";
  fs.writeFileSync(file, zlib.zstdCompressSync(Buffer.from(body)));
  const got = await lines(file);
  assert.equal(got.length, 5000);
  assert.equal(parseJson<{ i: number }>(got[4999])!.i, 4999);
});

test("a line longer than one read chunk (1 MB) stays whole", async () => {
  const dir = tempDir();
  const file = path.join(dir, "d.jsonl");
  const big = { big: "y".repeat(3 * 1024 * 1024) };
  fs.writeFileSync(file, JSON.stringify(big) + "\n{}\n");
  const got = await lines(file);
  assert.equal(got.length, 2);
  assert.equal(parseJson<typeof big>(got[0])!.big.length, big.big.length);
});
