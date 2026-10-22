// Remotion CLI settings for `npx remotion studio / still / render`.
// Kept minimal on purpose: the look of the video lives in src/, not here.
import { Config } from "@remotion/cli/config";

// JPEG frames render faster than PNG and we never need transparency in the video.
Config.setVideoImageFormat("jpeg");
// Overwrite old outputs instead of failing, so re-running /rewynd just works.
Config.setOverwriteOutput(true);
