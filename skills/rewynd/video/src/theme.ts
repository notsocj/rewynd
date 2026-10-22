// Colors and fonts for a card, worked out from the user's TEMPLATE + ACCENT.
//
// Why this file exists: scenes never hardcode colors or fonts. They ask for a
// Theme and paint with its fields. That way every template works with every
// scene (DESIGN.md §2, §8 and §9).
//
// A template is a whole visual style (tape, terminal, receipt, arcade). Each
// one offers 3 accent colors. themes.json is the user-facing list (ids,
// labels, accents) that scripts/ reads to ask "which look?". This file holds
// everything else about each template. Keep the two in sync.

import type { PersonalityId } from "../../contract/recap";
import { FACES } from "./fonts";
import themesFile from "./themes.json";

// ---------------------------------------------------------------------------
// Raw color tokens.
// ---------------------------------------------------------------------------

export const colors = {
  tape: "#131313", // the black of a videotape shell
  ink: "#1F1F1F", // outlines on illustrations
  paper: "#EFEEE9", // warm off-white, like a tape label sticker
  white: "#FFFFFF",
  blue: "#1D3DF2",
  rec: "#FF3B30", // the REC dot
  add: "#3DDC84", // diff green: lines added
  del: "#FF5C57", // diff red: lines removed
  amber: "#FFB627", // camcorder date-stamp orange
  lilac: "#A5A0FF",
} as const;

export type TemplateId = "tape" | "terminal" | "receipt" | "arcade";

/** Which typeface plays which role on a card. */
export type TemplateFonts = {
  ui: string; // on-screen labels, counters, small caps (REC, TAPE 03, scores...)
  hero: string; // the giant numbers
  body: string; // captions and sentences
  hand: string; // handwriting (the tape label), where a template has it
  heroWeight: number;
  // Width of one digit of the hero font, as a fraction of its size. Used to
  // size giant numbers without measuring text in the browser.
  heroDigitEm: number;
  heroTracking: string;
};

// Everything a scene needs to paint itself.
export type Theme = {
  id: TemplateId;
  template: TemplateId;
  accentId: string;
  bg: string; // card background (the "color field")
  fg: string; // main text
  dim: string; // secondary text (captions, sublines)
  faint: string; // very quiet lines and empty cells
  accent: string; // hero highlights
  rec: string;
  add: string; // diff green
  del: string; // diff red
  amber: string;
  osdShadow: string; // CSS text-shadow for on-screen text ("none" when not needed)
  panel: string; // terminal window background
  panelFg: string;
  panelDim: string;
  panelBorder: string;
  meterOff: string; // unlit segments of a level meter
  label: string; // tape label sticker background
  labelFg: string;
  stripes: [string, string, string];
  scanline: string; // faint horizontal TV lines ("transparent" = none)
  hardShadow: string; // flat offset shadow under labels and windows
  // Extra colors some templates use.
  paperBg: string; // receipt paper
  stamp: string; // receipt rubber stamp red
  pink: string; // arcade magenta
  cyan: string; // arcade cyan
  fonts: TemplateFonts;
};

// ---------------------------------------------------------------------------
// The templates. `make(accent)` builds the theme for one accent color.
// ---------------------------------------------------------------------------

const INTER = "rewynd-inter, system-ui, sans-serif";

const templates: Record<TemplateId, (accent: string) => Omit<Theme, "id" | "template" | "accentId">> = {
  // Tape: a camcorder recording. Dark shell, cream text, accent on the REC
  // light, the units and the pressed REW button. VT323 for the on-screen
  // display, Caveat for the handwritten label, Inter Black for the numbers.
  tape: (accent) => ({
    bg: "#16161A",
    fg: "#F2EDE4",
    dim: "#A8A8B3",
    faint: "#26262D",
    accent,
    rec: accent,
    add: "#7CF0B4",
    del: "#FF6B5E",
    amber: "#FFB020",
    osdShadow: "none",
    panel: "#1E1E24",
    panelFg: "#F2EDE4",
    panelDim: "#A8A8B3",
    panelBorder: "#4A4A55",
    meterOff: "#26262D",
    label: "#F2EDE4",
    labelFg: "#16161A",
    stripes: [colors.rec, "#FFB020", "#7CF0B4"],
    scanline: "rgba(255, 255, 255, 0.04)",
    hardShadow: "10px 10px 0 rgba(0, 0, 0, 0.45)",
    paperBg: "#F2EDE4",
    stamp: accent,
    pink: accent,
    cyan: "#A8A8B3",
    fonts: { ui: FACES.vt323, hero: INTER, body: INTER, hand: FACES.caveat, heroWeight: 900, heroDigitEm: 0.64, heroTracking: "-0.05em" },
  }),

  // Terminal: the whole card is a terminal window. Monospace everything,
  // GitHub-dark colors, diff lines in green / red.
  terminal: (accent) => ({
    bg: "#0B0D10",
    fg: "#E6EDF3",
    dim: "#8B949E",
    faint: "#21262D",
    accent,
    rec: "#FF5F57",
    add: "#56D364",
    del: "#FF7B72",
    amber: "#E3B341",
    osdShadow: "none",
    panel: "#15181D",
    panelFg: "#E6EDF3",
    panelDim: "#8B949E",
    panelBorder: "#2B2F36",
    meterOff: "#21262D",
    label: "#15181D",
    labelFg: "#E6EDF3",
    stripes: ["#FF5F57", "#FEBC2E", "#28C840"],
    scanline: "transparent",
    hardShadow: "none",
    paperBg: "#15181D",
    stamp: accent,
    pink: "#FF7B72",
    cyan: "#79C0FF",
    fonts: {
      ui: FACES.jetbrains,
      hero: FACES.jetbrains,
      body: FACES.jetbrains,
      hand: FACES.jetbrains,
      heroWeight: 800,
      heroDigitEm: 0.6,
      heroTracking: "-0.06em",
    },
  }),

  // Receipt: a till receipt on a bright color field. The accent IS the
  // background; everything on the paper prints in black ink.
  receipt: (accent) => ({
    bg: accent,
    fg: "#1A1A1A",
    dim: "#555555",
    faint: "rgba(26, 26, 26, 0.14)",
    accent: "#1A1A1A",
    rec: "#C8231B",
    add: "#1A1A1A",
    del: "#C8231B",
    amber: "#1A1A1A",
    osdShadow: "none",
    panel: "#FFFDF7",
    panelFg: "#1A1A1A",
    panelDim: "#555555",
    panelBorder: "#1A1A1A",
    meterOff: "rgba(26, 26, 26, 0.12)",
    label: "#FFFDF7",
    labelFg: "#1A1A1A",
    stripes: ["#1A1A1A", "#1A1A1A", "#1A1A1A"],
    scanline: "transparent",
    hardShadow: "none",
    paperBg: "#FFFDF7",
    stamp: "#C8231B",
    pink: "#C8231B",
    cyan: "#555555",
    fonts: {
      ui: FACES.spaceMono,
      hero: FACES.spaceMono,
      body: FACES.spaceMono,
      hand: FACES.spaceMono,
      heroWeight: 700,
      heroDigitEm: 0.62,
      heroTracking: "-0.06em",
    },
  }),

  // Arcade: an 8-bit cabinet screen. Deep indigo, pixel font, magenta
  // drop shadows, cyan labels, the accent on the score.
  arcade: (accent) => ({
    bg: "#14123A",
    fg: "#FFFFFF",
    dim: "#B9B6E8",
    faint: "#2E2A6E",
    accent,
    rec: "#FF5CD6",
    add: "#7CF08A",
    del: "#FF5CD6",
    amber: "#FFE14D",
    osdShadow: "none",
    panel: "#221F5C",
    panelFg: "#FFFFFF",
    panelDim: "#B9B6E8",
    panelBorder: "#5CF2FF",
    meterOff: "#2E2A6E",
    label: "#221F5C",
    labelFg: "#FFFFFF",
    stripes: ["#FF5CD6", "#5CF2FF", accent],
    scanline: "rgba(0, 0, 0, 0.12)",
    hardShadow: "10px 10px 0 #FF5CD6",
    paperBg: "#221F5C",
    stamp: "#FF5CD6",
    pink: "#FF5CD6",
    cyan: "#5CF2FF",
    fonts: { ui: FACES.pixel, hero: FACES.pixel, body: INTER, hand: FACES.pixel, heroWeight: 400, heroDigitEm: 1, heroTracking: "0em" },
  }),
};

// ---------------------------------------------------------------------------
// Lookups.
// ---------------------------------------------------------------------------

type ThemeEntry = { id: string; accents: { id: string; color: string }[] };
const entries = themesFile.themes as ThemeEntry[];

// Old theme ids from v0.1 (one layout, four color palettes) map onto the new
// templates, so saved preferences from before keep working.
const LEGACY: Record<string, { theme: TemplateId; accent: string }> = {
  night: { theme: "tape", accent: "mint" },
  midnight: { theme: "tape", accent: "mint" },
  bluescreen: { theme: "tape", accent: "amber" },
  label: { theme: "receipt", accent: "yellow" },
};

/** Theme for a template id + accent id. Unknown ids fall back to the default
 *  template / its first accent, so a typo in preferences never breaks a render. */
export const getTheme = (templateId: string, accentId?: string | null): Theme => {
  const legacy = LEGACY[templateId];
  const id = (legacy?.theme ?? templateId) as TemplateId;
  const entry = entries.find((e) => e.id === id) ?? entries.find((e) => e.id === themesFile.default)!;
  const template = entry.id as TemplateId;
  const accent = entry.accents.find((a) => a.id === (accentId ?? legacy?.accent)) ?? entry.accents[0];
  return { id: template, template, accentId: accent.id, ...templates[template](accent.color) };
};

/** Resolves "auto" to the personality's template + accent. render.ts normally
 *  does this already, but the video does it too so hand-written props work. */
export const resolveTheme = (
  themeId: string,
  accentId: string | null | undefined,
  personality: PersonalityId,
): { theme: string; accent: string | null } => {
  if (themeId !== "auto") return { theme: themeId, accent: accentId ?? null };
  const map = themesFile.personalityThemes as Record<string, { theme: string; accent: string }>;
  const pick = map[personality];
  return pick ? { theme: pick.theme, accent: accentId ?? pick.accent } : { theme: themesFile.default, accent: accentId ?? null };
};

/** True when the card's main surface is light (dark text). */
export const isLight = (theme: Theme) => theme.template === "receipt";
