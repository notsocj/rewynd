// Loads the typefaces the template can use and tells scenes which one to use.
//
// Why load fonts by hand: Remotion renders frames in a headless browser. If a
// frame is captured before the font file has loaded, that frame shows a
// fallback font. loadFont() pauses rendering (delayRender) until the font is
// ready, so every frame uses the right font.
//
// Why one font: every card uses Inter, so the video reads as one system.
// Numbers use Inter's same-width ("tabular") digits instead of a separate
// monospace font, which keeps the terminal look without a second typeface.
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

// Family names we register. Prefixed with "rewynd" so they can never clash
// with a font the user happens to have installed under the same name.
const INTER = "rewynd-inter";
const CUSTOM = "rewynd-custom";

// Start loading Inter as soon as this file is imported (~350 KB, one file
// covers every weight).
const pending: Promise<unknown>[] = [loadFont({ family: INTER, url: interVariable, weight: "100 900" })];

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
  // CSS font-family value. Always ends in a system fallback, just in case.
  family: string;
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
export const getFont = (customFontStaticPath: string | null): FontSpec => {
  if (customFontStaticPath) {
    ensureCustomFont(customFontStaticPath);
    if (customFontStatus.get(customFontStaticPath) !== "failed") {
      // We don't know an unknown font's digit width, so size for a wide one.
      return {
        family: `${CUSTOM}, ${INTER}, ${FALLBACK}`,
        digitEm: 0.68,
        heroTracking: "-0.04em",
        black: 900,
      };
    }
  }

  return { family: `${INTER}, ${FALLBACK}`, digitEm: 0.64, heroTracking: "-0.05em", black: 900 };
};
