// Everything a scene needs besides its own data, worked out once per render
// and shared through React context:
// - the theme colors and the font
// - whether we're rendering wide (16:9) or vertical (9:16), and a size scale
// - helpers that hide project/repo names when the user asked for that
//
// Why context: there are 12 scenes plus shared chrome (OSD, footer...).
// Passing all of this down as props through every layer would be noisy and
// easy to get wrong. Each scene just calls useRecap().

import React, { createContext, useContext, useMemo } from "react";
import { useVideoConfig } from "remotion";
import type { RecapProps, SceneId } from "../../../contract/recap";
import { REPO_URL } from "../../../contract/recap";
import { getFont, type FontSpec } from "../fonts";
import { getTheme, resolveTheme, type Theme } from "../theme";

export type Recap = {
  props: RecapProps;
  theme: Theme;
  font: FontSpec;
  wide: boolean;
  // Multiply sizes by this. 1 for vertical; smaller for wide, where the
  // picture is only 1080px tall.
  s: number;
  // Display name for a project or repo ("Project A" when names are hidden).
  name: (raw: string) => string;
  // Free text (story lines) with any known project name swapped for its
  // alias when names are hidden, so a caption can't leak a client's name.
  text: (raw: string) => string;
  repoUrl: string;
  // "TAPE 03 · …" numbering on the tape labels.
  tapeNumber: (scene: SceneId) => string;
};

const RecapContext = createContext<Recap | null>(null);

// Every project/repo name that can appear anywhere in the video, most
// important first, so "Project A" is always the top project.
const knownNames = (props: RecapProps): string[] => {
  const { stats, story } = props;
  const names = [
    ...stats.projects.map((p) => p.name),
    ...(stats.shipped?.byRepo.map((r) => r.name) ?? []),
    ...(stats.longestSession ? [stats.longestSession.project] : []),
    ...story.projects.map((p) => p.name),
    ...(story.hardestBug?.project ? [story.hardestBug.project] : []),
  ];
  return [...new Set(names.filter(Boolean))];
};

// A, B, ... Z, then AA, AB... (in case someone has more than 26 projects).
const letters = (i: number): string =>
  i < 26 ? String.fromCharCode(65 + i) : letters(Math.floor(i / 26) - 1) + letters(i % 26);

// Escape a string so it can be used literally inside a RegExp.
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const RecapProvider: React.FC<{ props: RecapProps; children: React.ReactNode }> = ({ props, children }) => {
  const { width, height } = useVideoConfig();

  const value = useMemo<Recap>(() => {
    const wide = width > height;
    const pick = resolveTheme(props.prefs.theme, props.prefs.accent, props.story.personality.id);
    const theme = getTheme(pick.theme, pick.accent);
    const hide = props.prefs.hideProjectNames;

    const aliases = new Map<string, string>();
    knownNames(props).forEach((n, i) => aliases.set(n, `Project ${letters(i)}`));
    // Names to scrub from free text, longest first so "lumen-web" is
    // replaced before "lumen". Names under 3 characters are skipped: they
    // can't identify a client, and a project called "a" would otherwise
    // replace the word "a" in every sentence. (They're still hidden
    // wherever a name is shown on its own.)
    const byLength = [...aliases.keys()].filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);

    return {
      props,
      theme,
      font: getFont(props.customFontStaticPath, theme.fonts),
      wide,
      s: wide ? 0.74 : 1,
      name: (raw) => (hide ? aliases.get(raw) ?? "Project ?" : raw),
      // Only whole names are replaced: the name can't have a letter, digit,
      // "_" or "-" right before or after it. Otherwise a project called "a"
      // would turn "a long line" into "Project A long line" and also eat
      // the "a" inside every word.
      text: (raw) =>
        hide
          ? byLength.reduce(
              (t, n) =>
                t.replace(new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRegExp(n)}(?![\\p{L}\\p{N}_-])`, "giu"), aliases.get(n)!),
              raw,
            )
          : raw,
      repoUrl: props.repoUrl || REPO_URL,
      tapeNumber: (scene) => String(Math.max(0, props.scenes.indexOf(scene)) + 1).padStart(2, "0"),
    };
  }, [props, width, height]);

  return <RecapContext.Provider value={value}>{children}</RecapContext.Provider>;
};

export const useRecap = (): Recap => {
  const ctx = useContext(RecapContext);
  if (!ctx) throw new Error("useRecap() must be used inside <RecapProvider>.");
  return ctx;
};
