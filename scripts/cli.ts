// =============================================================================
// cli.ts — the one entry point the skills call.
//
//   node --disable-warning=ExperimentalWarning scripts/cli.ts <command> [flags]
//
// Commands:
//   collect  [--month YYYY-MM | --year YYYY] [--github]  save days, write stats.json + samples.json
//   save                                                save new days only (no stats)
//   status                                              what's saved, what's on disk, what's at risk
//   story-check                                         validate output/story.json against stats.json
//   themes                                              list video themes (for the design question)
//   prefs    [--set '<json>']                           show / update data/preferences.json
//   render   [--card] [--format vertical|wide|both]     render the video (or one image)
//   migrate-data --from <dir>                           copy saved days from an older install
//   guard                                               check that data/ isn't tracked by git
//
// Common flags: --data-dir <dir> (where data/ + output/ live), --tz <IANA zone>
//
// stdout = ONE JSON object (for the skill to read). Progress/warnings go to stderr.
// =============================================================================

import { parseArgs, str } from "./lib/args.ts";
import { setStateRoot, tildify } from "./lib/paths.ts";
import { setTimezone } from "./lib/time.ts";
import { collectedWarnings, errMsg } from "./lib/log.ts";
import { checkNotTracked } from "./store/git-guard.ts";
import { collect, type CollectResult } from "./collect.ts";
import { parsePeriod } from "./stats/period.ts";

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  setStateRoot(str(flags, "data-dir"));
  setTimezone(str(flags, "tz"));

  // Every command checks first that nobody's personal stats are about to be pushed.
  const guard = checkNotTracked();

  let out: unknown;
  switch (command) {
    case "collect": {
      const period = parsePeriod({ month: str(flags, "month"), year: str(flags, "year") });
      out = summarize(await collect({ period, github: flags.github === true }));
      break;
    }
    case "save":
      out = await collect({ period: null, github: false });
      break;
    case "guard":
      out = guard;
      break;
    default: {
      const mod = await import("./commands.ts");
      out = await mod.runCommand(command, flags);
    }
  }
  print({ ok: true, command, ...(out as object), gitGuard: guard, warnings: collectedWarnings() });
}

/**
 * The skill only needs headlines + file paths: Claude reads stats.json itself
 * when writing the story, so we don't dump the whole thing into the terminal.
 */
function summarize(r: CollectResult) {
  const s = r.stats;
  return {
    files: { stats: r.files.stats && tildify(r.files.stats), samples: r.files.samples && tildify(r.files.samples) },
    saved: r.saved,
    agents: r.agents.map(({ id, label, found, supported, humanSessions, backgroundSessions, note, error }) => ({
      id, label, found, supported, humanSessions, backgroundSessions, note: error ? `error: ${error}` : note,
    })),
    github: r.github,
    headline: s && {
      period: s.period.label,
      coverage: s.coverage,
      activeHours: s.totals.activeHours,
      sessions: s.totals.sessions,
      activeDays: s.totals.activeDays,
      agents: s.agentShare.map((a) => `${a.agent} ${a.percent}%`),
      topProject: s.projects[0]?.name ?? null,
      shipped: s.shipped && { commits: s.shipped.commits, aiShare: s.shipped.aiShare },
      backgroundRuns: s.backgroundRuns.total,
      personalityTop3: s.personalityHints.slice(0, 3).map((p) => p.id),
    },
  };
}

function print(obj: unknown) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

main().catch((e) => {
  print({ ok: false, error: errMsg(e), warnings: collectedWarnings() });
  process.exitCode = 1;
});
