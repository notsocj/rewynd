// Loads the typefaces the template can use and tells scenes which one to use.
//
// Why load fonts by hand: Remotion renders frames in a headless browser. If a
// frame is captured before the font file has loaded, that frame shows a
// fallback font. loadFont() pauses rendering (delayRender) until the font is
// ready, so every frame uses the right font.
//
// Inter is the base font. Each card TEMPLATE adds its own voice on top
// (templates/, DESIGN.md §9):
//   tape     → VT323 (camcorder on-screen text) + Caveat (handwritten tape label)
//   terminal → JetBrains Mono
//   receipt  → Space Mono
//   arcade   → Press Start 2P (pixel font)
// All are open-source (SIL OFL), installed from npm, loaded the same way.
//
// Why files come from node_modules: Inter is open-source (SIL OFL) and
// installed through npm, so the file is on disk and rendering never makes a
// network call. Importing a .woff2 makes Remotion's bundler copy the
// file and hand us a local URL for it.

import { loadFont } from "@remotion/fonts";
import { continueRender, delayRender, staticFile } from "remotion";

// Inter v4 variable font with BOTH axes: weight (100–900) and optical size.
// With optical size, the browser switches to Inter "Display" glyphs at big
// font sizes automatically (font-optical-sizing: auto is the default), which
// are tighter and cut for giant numbers.
import interVariable from "@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2";
import vt323 from "@fontsource/vt323/files/vt323-latin-400-normal.woff2";
import caveat from "@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2";
import jetbrains from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2";
import spaceMono400 from "@fontsource/space-mono/files/space-mono-latin-400-normal.woff2";
import spaceMono700 from "@fontsource/space-mono/files/space-mono-latin-700-normal.woff2";
import pressStart from "@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2";

// Family names we register. Prefixed with "rewynd" so they can never clash
// with a font the user happens to have installed under the same name.
const INTER = "rewynd-inter";
const CUSTOM = "rewynd-custom";

/** The template fonts, as ready-to-use CSS font-family values. */
export const FACES = {
  vt323: `rewynd-vt323, ui-monospace, monospace`,
  caveat: `rewynd-caveat, cursive`,
  jetbrains: `rewynd-jetbrains, ui-monospace, monospace`,
  spaceMono: `rewynd-spacemono, ui-monospace, monospace`,
  pixel: `rewynd-pixel, ui-monospace, monospace`,
} as const;

// Start loading Inter as soon as this file is imported (~350 KB, one file
// covers every weight).
// The template fonts are small (10–40 KB each), so they all load up front.
const pending: Promise<unknown>[] = [
  loadFont({ family: INTER, url: interVariable, weight: "100 900" }),
  loadFont({ family: "rewynd-vt323", url: vt323, weight: "400" }),
  loadFont({ family: "rewynd-caveat", url: caveat, weight: "400 700" }),
  loadFont({ family: "rewynd-jetbrains", url: jetbrains, weight: "100 800" }),
  loadFont({ family: "rewynd-spacemono", url: spaceMono400, weight: "400" }),
  loadFont({ family: "rewynd-spacemono", url: spaceMono700, weight: "700" }),
  loadFont({ family: "rewynd-pixel", url: pressStart, weight: "400" }),
];

/** Resolves once every font we started loading is ready. Layout code that
 *  measures text (FitBox) waits for this, because text measured with a
 *  fallback font has the wrong size. */
export const fontsReady = (): Promise<void> =>
  Promise.allSettled(pending).then(() => document.fonts.ready.then(() => undefined));

// ---------------------------------------------------------------------------
// Custom font ("My own font" in the design questions).
// ---------------------------------------------------------------------------

// Remember which custom files we already tried, so re-renders of the same
// frame don't load the font again. The value says whether it worked.
const customFontStatus = new Map<string, "loading" | "ok" | "failed">();

// Why not loadFont() from @remotion/fonts here: loadFont() cancels the whole
// render when a file fails to load. A user's own font file can be anything
// (corrupt, wrong format), so instead we load it with the browser's FontFace
// API under the same delayRender pause, and on failure mark it as failed so
// the scenes quietly fall back to Inter, as promised in DESIGN.md §8.
const ensureCustomFont = (file: string) => {
  if (customFontStatus.has(file)) return;
  customFontStatus.set(file, "loading");
  const handle = delayRender(`Loading custom font ${file}`);
  const face = new FontFace(CUSTOM, `url(${staticFile(file)})`, { weight: "100 900" });
  const loading = face
    .load()
    .then(() => {
      document.fonts.add(face);
      customFontStatus.set(file, "ok");
    })
    .catch(() => {
      console.warn(`rewynd: couldn't load custom font "${file}", using Inter instead.`);
      customFontStatus.set(file, "failed");
    })
    .finally(() => continueRender(handle));
  pending.push(loading);
};

// ---------------------------------------------------------------------------
// What scenes ask for.
// ---------------------------------------------------------------------------

export type FontSpec = {
  // CSS font-family value for body text. Always ends in a system fallback.
  family: string;
  // The template's other voices (see theme.ts → TemplateFonts).
  hero: string; // giant numbers
  ui: string; // labels, counters, small caps
  hand: string; // handwriting
  // Width of one tabular digit as a fraction of the font size. Used to size
  // the hero number so it fills the card width without measuring text in
  // the browser. Checked against rendered stills.
  digitEm: number;
  // Letter spacing for giant text. Wider fonts need less tightening.
  heroTracking: string;
  // Heaviest weight the font has. Inter goes to 900.
  black: number;
};

// Fallbacks after our font: the system UI font, then the color-emoji fonts
// of each OS, so emoji in project names ("🚀 launchpad") still render.
const FALLBACK = 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** Font for a render. `customFontStaticPath` is the user's own font file,
 *  relative to video/public (scripts/render.ts copies it there), or null. */
export const getFont = (
  customFontStaticPath: string | null,
  t: { ui: string; hero: string; body: string; hand: string; heroWeight: number; heroDigitEm: number; heroTracking: string },
): FontSpec => {
  if (customFontStaticPath) {
    ensureCustomFont(customFontStaticPath);
    if (customFontStatus.get(customFontStaticPath) !== "failed") {
      // The user's own font replaces the body text and the giant numbers.
      // The template keeps its label font, so it still reads as that template.
      // We don't know an unknown font's digit width, so size for a wide one.
      const custom = `${CUSTOM}, ${INTER}, ${FALLBACK}`;
      return { family: custom, hero: custom, ui: t.ui, hand: t.hand, digitEm: 0.68, heroTracking: "-0.04em", black: 900 };
    }
  }
  return {
    family: `${t.body}, ${FALLBACK}`,
    hero: `${t.hero}, ${FALLBACK}`,
    ui: `${t.ui}, ${FALLBACK}`,
    hand: `${t.hand}, ${FALLBACK}`,
    digitEm: t.heroDigitEm,
    heroTracking: t.heroTracking,
    black: t.heroWeight,
  };
};
