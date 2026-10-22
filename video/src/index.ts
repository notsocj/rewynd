// Entry point Remotion looks for. It only registers the root component,
// which lists every composition (video or still) this template can render.
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
