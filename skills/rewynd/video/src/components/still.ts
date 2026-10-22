// True while the template renders a still image (the share card, carousel
// slides) instead of the video. Things that blink (the REC dot, terminal
// cursors, the arcade's attract line) stay lit in a still, so the picture
// never catches them in their "off" half and looks broken.

import { createContext, useContext } from "react";

export const StillContext = createContext(false);

export const useIsStill = () => useContext(StillContext);
