// =============================================================================
// samples/redact.ts — scrub secrets and personal details from text BEFORE it
// is written to output/samples.json (the only text Claude ever reads).
//
// Belt and braces: patterns for well-known key formats, "key = value" lines
// that look secret, .env lines, credentials in URLs, emails, home-folder paths
// (they contain your username) and long random-looking strings. Over-redacting
// is fine: the story needs the gist of a message, not its exact tokens.
// =============================================================================

const R = "[REDACTED]";

const RULES: [RegExp, string | ((m: string, ...g: string[]) => string)][] = [
  // Whole private-key blocks.
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, R],
  // JSON Web Tokens (three base64url parts).
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, R],
  // Well-known API key formats.
  [/\b(sk-ant-[A-Za-z0-9_-]{10,}|sk-(proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|glpat-[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{30,}|hf_[A-Za-z0-9]{30,}|(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|ya29\.[A-Za-z0-9_-]{20,}|AC[a-f0-9]{32}|re_[A-Za-z0-9]{20,})\b/g, R],
  // "Authorization: Bearer xyz", "Basic xyz"
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{12,}/g, (_m, kind) => `${kind} ${R}`],
  // Credentials inside URLs: scheme://user:pass@host
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi, (_m, scheme) => `${scheme}${R}@`],
  // Secret-looking query params: ?token=..., &key=..., &sig=...
  [/([?&](?:token|key|apikey|api_key|access_token|secret|sig|signature|password|auth|code)=)[^&\s#]+/gi, (_m, k) => `${k}${R}`],
  // key: value / key = value where the key sounds secret.
  [/\b([A-Za-z0-9_.-]*(?:api[_-]?key|secret|token|passw(?:or)?d|pwd|credential|private[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?key|session[_-]?id|cookie)[A-Za-z0-9_.-]*)(["']?\s*[:=]\s*["']?)([^\s"',;&]{4,})/gi, (_m, k, sep) => `${k}${sep}${R}`],
  // .env-style lines: SOME_NAME=value
  [/^(\s*(?:export\s+)?[A-Z][A-Z0-9_]{2,})=(.+)$/gm, (_m, k) => `${k}=${R}`],
  // Email addresses.
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"],
  // Home folders (they contain your username).
  [/\/Users\/[^/\s"'`]+/g, "~"],
  [/\/home\/[^/\s"'`]+/g, "~"],
  [/[A-Za-z]:\\Users\\[^\\\s"'`]+/g, "~"],
  // IP addresses.
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]"],
  // Card-like numbers (13–19 digits, optional spaces/dashes).
  [/\b(?:\d[ -]?){12,18}\d\b/g, R],
];

/** Long strings that look random (mixed letters + digits, 32+ chars), e.g. tokens and hashes. */
const RANDOMISH = /\b[A-Za-z0-9+/_=-]{32,}\b/g;
function looksRandom(s: string): boolean {
  const hasLower = /[a-z]/.test(s);
  const hasUpper = /[A-Z]/.test(s);
  const hasDigit = /\d/.test(s);
  return (hasDigit && (hasLower || hasUpper)) || /^[0-9a-f]{32,}$/i.test(s);
}

export function redact(text: string): string {
  let out = text;
  for (const [re, rep] of RULES) out = out.replace(re, rep as any);
  out = out.replace(RANDOMISH, (m) => (looksRandom(m) ? R : m));
  return out;
}
