// =============================================================================
// lib/lines.ts — stream a .jsonl (or zstd-compressed .jsonl.zst) file line by line.
//
// Why not Node's built-in `readline`?
//   readline also treats the Unicode characters U+2028 and U+2029 as line
//   breaks. Those characters legally appear INSIDE JSON strings (we found them
//   in real Codex logs), so readline cuts one JSON record into broken halves.
//   JSONL only ever uses "\n" between records, so we split on that byte only.
//
// Why Buffers instead of strings?
//   Some log lines are huge (we've seen 2 MB single lines, and whole files of
//   ~700 MB). Callers can peek at the first few hundred bytes to decide whether
//   the line is even worth decoding + JSON.parse-ing, which keeps a full scan
//   of ~10 GB of logs around 15–20 seconds.
//
// Memory: only the current chunk (1 MB) plus one line are ever held, so file
// size doesn't matter.
// =============================================================================

import fs from "node:fs";
import zlib from "node:zlib";
import type { Readable } from "node:stream";

/** Yields each non-empty line as a Buffer (without the trailing "\n" / "\r\n"). */
export async function* readLineBuffers(file: string): AsyncGenerator<Buffer> {
  let stream: Readable = fs.createReadStream(file, { highWaterMark: 1 << 20 });
  if (file.endsWith(".zst")) {
    // Node ≥ 22.15 ships zstd, so newer Codex .jsonl.zst rollouts need no npm package.
    stream = stream.pipe(zlib.createZstdDecompress());
  }

  // Bytes of a line that started in an earlier chunk but hasn't ended yet.
  let pending: Buffer[] = [];

  try {
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      let start = 0;
      let nl: number;
      while ((nl = chunk.indexOf(10, start)) !== -1) {
        let piece = chunk.subarray(start, nl);
        if (pending.length) {
          pending.push(piece);
          piece = Buffer.concat(pending);
          pending = [];
        }
        const line = trimCR(piece);
        if (line.length) yield line;
        start = nl + 1;
      }
      // Whatever is left has no "\n" yet: keep it for the next chunk.
      if (start < chunk.length) pending.push(chunk.subarray(start));
    }
    // Last line of a file that doesn't end with "\n".
    if (pending.length) {
      const line = trimCR(Buffer.concat(pending));
      if (line.length) yield line;
    }
  } finally {
    stream.destroy();
  }
}

/** Drop a trailing "\r" (files written on Windows use "\r\n"). */
function trimCR(b: Buffer): Buffer {
  return b.length && b[b.length - 1] === 13 ? b.subarray(0, b.length - 1) : b;
}

/** Decode only the first `n` bytes: cheap way to sniff a record's "type". */
export function head(line: Buffer, n = 400): string {
  return line.toString("utf8", 0, Math.min(line.length, n));
}

/** JSON.parse that returns null instead of throwing on a broken/partial line. */
export function parseJson<T = any>(line: Buffer | string): T | null {
  try {
    return JSON.parse(typeof line === "string" ? line : line.toString("utf8")) as T;
  } catch {
    return null;
  }
}
