// Where things go on the card, for both sizes.
//
// Vertical (1080×1920) is for TikTok / Reels / Stories: those apps cover the
// bottom ~200px and the right edge with their own buttons, so the footer and
// transport sit above that. Wide (1920×1080) is for X / YouTube: no app UI
// on top, but the picture is short, so everything is tighter.

export type Frame = {
  side: number; // left/right margin
  osdTop: number; // top of the REC / counter row
  contentTop: number; // where scene content may start
  contentBottom: number; // where scene content must end
  transportBottom: number; // distance from the bottom edge to the transport bar
  footerBottom: number; // distance from the bottom edge to the footer row
};

export const VERTICAL: Frame = {
  side: 96,
  osdTop: 150,
  contentTop: 260,
  contentBottom: 1520,
  transportBottom: 300,
  footerBottom: 200,
};

// In wide, the transport bar and the footer share one row at the bottom.
export const WIDE: Frame = {
  side: 96,
  osdTop: 54,
  contentTop: 140,
  contentBottom: 940,
  transportBottom: 44,
  footerBottom: 56,
};

export const frameFor = (wide: boolean): Frame => (wide ? WIDE : VERTICAL);
