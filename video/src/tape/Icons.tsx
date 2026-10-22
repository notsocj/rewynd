// Tape-deck transport symbols (rewind, play, stop, record) drawn as SVG.
//
// Why not text characters like ◀◀ ▶ ■ ●: fonts draw those glyphs at
// different sizes and some fonts don't have them at all. SVG shapes look the
// same everywhere and line up exactly.

import React from "react";

type IconProps = { size: number; color: string };

// Two left-pointing triangles. This is also the rewynd mark.
export const RewindIcon: React.FC<IconProps> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M11.5 5 L2 12 L11.5 19 Z M22 5 L12.5 12 L22 19 Z" fill={color} />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M6 4 L20 12 L6 20 Z" fill={color} />
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect x="5" y="5" width="14" height="14" fill={color} />
  </svg>
);

export const RecIcon: React.FC<IconProps> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill={color} />
  </svg>
);
