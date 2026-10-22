// =============================================================================
// sources/user-text.ts — what you actually typed, inside a "user" message.
//
// The desktop apps wrap your text in context they add themselves, and log the
// whole thing as one "user" message:
//
//   <artifact-view-context artifact="…">…</artifact-view-context>   ← app
//   make the header smaller                                          ← you
//
//   # Files mentioned by the user:                                   ← Codex IDE
//   ## shot.png: /Users/me/Desktop/shot.png
//   ## My request for Codex:
//   make the header smaller                                          ← you
//
// Some "user" messages are entirely the app's (an attached skill's full text,
// a page the app opened, a scheduled heartbeat). Left in, they count as your
// messages, their words count as your "why"s and "fix it"s, and they end up in
// samples.json, sometimes with file names that give away who you are.
//
// The adapters' own INJECTED lists still drop the agent's long-known
// injections (<system-reminder>, <environment_context>...) first.
// =============================================================================

/** Wrappers that are the whole message: nothing in them was typed by you. */
const APP_ONLY = /^\s*<(skill|heartbeat|recommended_plugins|external_codex_apps_open_page|codex_internal_context|realtime_delegation|artifact-content-authored-by-others)\b/;

/** You did this, but there's no prose: a `!` shell command, a picked answer. */
const NO_PROSE = /^\s*<(bash-input|send_user_message_question_reply)\b/;

/** Context blocks the app puts BEFORE your text. Your words follow the closing tag. */
const LEADING_BLOCK = /^\s*<(artifact-view-context|in-app-browser-context|pasted_content)\b[^>]*>[\s\S]*?<\/\1\b[^>]*>/;

/** Codex's IDE preamble ("# Files mentioned by the user:" ...). Your words follow "## My request…:". */
const PREAMBLE = /^\s*#{1,2} (Context from my IDE setup|Files mentioned by the user|Files pasted by the user|Referenced ChatGPT conversation|In app browser):?/;
const REQUEST_HEADER = /^#{1,2} My request[^\n]*:[ \t]*$/gm;

/** <image name=[Image #1] path="/Users/me/Desktop/shot.png"></image> */
const INLINE_IMAGE = /<image\b[^>]*>(?:[\s\S]*?<\/image>)?/g;

/**
 * Your own words in a "user" message:
 *   null → the app wrote all of it (not a message from you at all)
 *   ""   → you, but nothing to read (a command, a multiple-choice answer)
 *   text → what you typed, with the app's wrappers removed
 */
export function typedText(text: string): string | null {
  if (APP_ONLY.test(text)) return null;
  if (NO_PROSE.test(text)) return "";
  let t = text;
  // Blocks can stack (a pasted block inside an artifact view...): peel them all.
  for (let m = t.match(LEADING_BLOCK); m; m = t.match(LEADING_BLOCK)) t = t.slice(m[0].length);
  const headers = [...t.matchAll(REQUEST_HEADER)];
  if (headers.length) {
    const last = headers[headers.length - 1];
    t = t.slice(last.index! + last[0].length);
  } else if (PREAMBLE.test(t)) {
    return ""; // only the app's file list, no request
  }
  // Attached images show up inline with their file path: keep only that there was one.
  return t.replace(INLINE_IMAGE, "[image]").trim();
}
