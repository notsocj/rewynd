// Colors, and the logic that turns a theme id into the colors for a card.
//
// Why this file exists: scenes never hardcode colors. They ask getTheme()
// for a Theme and paint with its fields. That way every theme in
// themes.json works with every scene (DESIGN.md §2 and §8).
//
// themes.json is the user-facing list (id, label, description) that
// scripts/ reads to ask "which theme?". This file holds the actual colors
// for each id. Keep the two in sync: every id in themes.json needs an entry
// in `palettes` below.

import type { PersonalityId } from "../../contract/recap";
import themesFile from "./themes.json";

// ---------------------------------------------------------------------------
// Raw color tokens (DESIGN.md §2).
// ---------------------------------------------------------------------------

export const colors = {
  tape: "#131313", // the black of a videotape shell, softer than #000
  ink: "#1F1F1F", // outlines on illustrations
  paper: "#EFEEE9", // warm off-white, like a tape label sticker
  white: "#FFFFFF", // on-screen display (OSD) text on blue screen
  blue: "#1D3DF2", // the "no signal" blue of a VCR, pushed brighter
  rec: "#FF3B30", // the REC dot
  add: "#3DDC84", // diff green: lines added
  del: "#FF5C57", // diff red: lines removed
  amber: "#FFB627", // camcorder date-stamp orange
  lilac: "#A5A0FF", // night-sky accent
} as const;

// Everything a scene needs to paint itself.
export type Theme = {
  id: string;
  bg: string; // card background (the "color field")
  fg: string; // main text
  dim: string; // secondary text (captions, sublines)
  faint: string; // very quiet lines and empty cells
  accent: string; // hero numbers and highlights
  rec: string; // the REC dot / active-recording red
  add: string; // diff green
  del: string; // diff red
  amber: string; // date stamps, the "hot" end of level meters
  osdShadow: string; // CSS text-shadow for on-screen text ("none" when not needed)
  panel: string; // terminal window background (always dark, on every theme)
  panelFg: string; // text inside the terminal
  panelDim: string; // quieter text inside the terminal
  panelBorder: string; // terminal window edge
  meterOff: string; // unlit segments of a level meter (inside the terminal)
  label: string; // tape label sticker background
  labelFg: string; // text on the tape label
  stripes: [string, string, string]; // colored bands across the tape label
  scanline: string; // color of the faint horizontal TV lines
  hardShadow: string; // the flat offset shadow under labels and windows
};

// Parts that are the same on every theme: the terminal is always a dark
// "screen inside the screen", so diff colors and meters read the same
// everywhere, and the tape label is always a paper sticker.
const shared = {
  rec: colors.rec,
  add: colors.add,
  del: colors.del,
  amber: colors.amber,
  panelFg: colors.paper,
  panelDim: "rgba(239, 238, 233, 0.5)",
  meterOff: "rgba(239, 238, 233, 0.1)",
  label: colors.paper,
  labelFg: colors.tape,
  stripes: [colors.rec, colors.amber, colors.add] as [string, string, string],
};

const darkBase = {
  ...shared,
  bg: colors.tape,
  fg: colors.paper,
  dim: "rgba(239, 238, 233, 0.6)",
  faint: "rgba(239, 238, 233, 0.16)",
  osdShadow: "none",
  panel: "#1D1D1D",
  panelBorder: "#343434",
  scanline: "rgba(255, 255, 255, 0.035)",
  hardShadow: "10px 10px 0 rgba(0, 0, 0, 0.45)",
};

// The colors for every theme id in themes.json.
const palettes: Record<string, Omit<Theme, "id">> = {
  // Night: a black tape playing in a dark room.
  night: { ...darkBase, accent: colors.add },
  // Midnight: same tape, lilac numbers (the 3AM Shipper's night sky).
  midnight: { ...darkBase, accent: colors.lilac },
  // Blue screen: full-bleed VCR blue. White text with a hard drop shadow,
  // like a real VCR menu. Red never sits directly on the blue (it shimmers),
  // so the diff colors live inside the dark terminal window.
  bluescreen: {
    ...shared,
    bg: colors.blue,
    fg: colors.white,
    dim: "rgba(255, 255, 255, 0.78)",
    faint: "rgba(255, 255, 255, 0.22)",
    accent: colors.amber,
    osdShadow: "4px 4px 0 rgba(0, 0, 0, 0.35)",
    panel: colors.tape,
    panelBorder: colors.tape,
    scanline: "rgba(0, 0, 0, 0.09)",
    hardShadow: "12px 12px 0 rgba(0, 0, 0, 0.35)",
  },
  // Tape label: the light option. Off-white paper, black text, red numbers.
  // The tape label sticker becomes black-on-white with a black outline so it
  // still stands out on a paper background.
  label: {
    ...shared,
    bg: colors.paper,
    fg: colors.tape,
    dim: "rgba(19, 19, 19, 0.62)",
    faint: "rgba(19, 19, 19, 0.14)",
    accent: colors.rec,
    osdShadow: "none",
    panel: colors.tape,
    panelBorder: colors.tape,
    label: colors.white,
    scanline: "rgba(0, 0, 0, 0.04)",
    hardShadow: "10px 10px 0 rgba(19, 19, 19, 0.9)",
  },
};

// ---------------------------------------------------------------------------
// Lookups.
// ---------------------------------------------------------------------------

/** Theme for a theme id. Unknown ids fall back to the default theme so a
 *  typo in preferences never breaks a render. */
export const getTheme = (themeId: string): Theme => {
  const id = palettes[themeId] ? themeId : themesFile.default;
  return { id, ...palettes[id] };
};

/** Resolves "auto" to the personality's theme. render.ts normally does this
 *  already, but the video does it too so props written by hand still work. */
export const resolveThemeId = (themeId: string, personality: PersonalityId): string => {
  if (themeId !== "auto") return themeId;
  const map = themesFile.personalityThemes as Record<string, string>;
  return map[personality] ?? themesFile.default;
};

/** True when the theme is light (dark text on a light background). A few
 *  details flip on light themes, e.g. which way shadows read. */
export const isLight = (theme: Theme) => theme.bg === colors.paper;
