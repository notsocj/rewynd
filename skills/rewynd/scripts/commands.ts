// =============================================================================
// commands.ts — the CLI commands other than collect/save/guard (see cli.ts).
// Each returns a plain object that cli.ts prints as JSON for the skill.
// =============================================================================

import path from "node:path";
import { outputDir, tildify } from "./lib/paths.ts";
import { readJsonFile } from "./lib/files.ts";
import { str } from "./lib/args.ts";
import { bugNumbersFrom, validateStory } from "./story/validate-story.ts";
import { loadPrefs, updatePrefs } from "./render/prefs.ts";
import { loadThemes, render } from "./render/render.ts";
import { status } from "./status.ts";
import { migrateFrom } from "./migrate.ts";
import type { DesignPrefs, Stats } from "../contract/recap.ts";

type Flags = Record<string, string | boolean>;

export async function runCommand(command: string, flags: Flags): Promise<unknown> {
  switch (command) {
    case "status":
      return status();

    case "story-check": {
      const stats = readJsonFile<Stats | null>(path.join(outputDir(), "stats.json"), null);
      const story = readJsonFile<unknown>(path.join(outputDir(), "story.json"), null);
      if (!stats) throw new Error("output/stats.json is missing. Run `collect` first");
      if (!story) throw new Error(`output/story.json is missing or isn't valid JSON (${tildify(path.join(outputDir(), "story.json"))})`);
      const samples = readJsonFile<unknown>(path.join(outputDir(), "samples.json"), null);
      return validateStory(story, stats, bugNumbersFrom(samples));
    }

    case "themes":
      return loadThemes();

    case "prefs": {
      const set = str(flags, "set");
      if (set) {
        let patch: any;
        try {
          patch = JSON.parse(set);
        } catch {
          throw new Error(`--set must be JSON, e.g. '{"design":{"theme":"auto","format":"vertical"}}'`);
        }
        return { prefs: updatePrefs(patch) };
      }
      return { prefs: loadPrefs() };
    }

    case "render": {
      const format = str(flags, "format") as DesignPrefs["format"] | undefined;
      if (format && !["vertical", "wide", "both"].includes(format)) throw new Error("--format must be vertical, wide or both");
      if (flags.card === true && flags.carousel === true) throw new Error("pick one: --card or --carousel");
      const r = render({ card: flags.card === true, carousel: flags.carousel === true, format });
      if ("errors" in r) return { rendered: false, storyErrors: r.errors };
      return { rendered: true, ...r, files: r.files.map(tildify), props: tildify(r.props) };
    }

    case "migrate-data": {
      const from = str(flags, "from");
      if (!from) throw new Error("migrate-data needs --from <folder>");
      return migrateFrom(from);
    }

    case "help":
    case "--help":
      return {
        usage: "node --disable-warning=ExperimentalWarning scripts/cli.ts <command> [flags]",
        commands: ["collect [--month YYYY-MM | --year YYYY] [--github]", "save", "status", "story-check", "themes", "prefs [--set JSON]", "render [--card | --carousel] [--format vertical|wide|both]", "migrate-data --from DIR", "guard"],
        flags: ["--data-dir DIR", "--tz Area/City"],
      };

    default:
      throw new Error(`unknown command "${command}". Try: help`);
  }
}
