// Code visuals shared by the cards: a terminal window, a command that types
// itself out, and a blinking block cursor.
//
// The 3AM Shipper badge (a tiny terminal saying "> ship it") was the best
// part of the first design, so this direction builds on it: the stats look
// like output from a command you just ran.

import React, { createContext, useContext } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useIsStill } from "../components/still";
import { useRecap } from "../recap/context";

// True inside a TerminalWindow. The terminal is always dark, so text in it
// must use the panel colors, not the card's (on the light theme the card's
// dim text is dark gray and would vanish on the black terminal).
const InPanel = createContext(false);
// True inside a plain (window-less) block on the TERMINAL template: the
// scene heading already printed the command, so prompts inside are skipped.
const NoPrompt = createContext(false);

// ---------------------------------------------------------------------------
// Blinking block cursor.
// ---------------------------------------------------------------------------

type CursorProps = {
  color: string;
  // Size in em, so the cursor scales with whatever text it follows.
  width?: string;
  height?: string;
};

export const Cursor: React.FC<CursorProps> = ({ color, width = "0.5em", height = "0.95em" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const still = useIsStill();
  // On for half a second, off for half a second, like a real terminal.
  const on = still || Math.floor(frame / (fps / 2)) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width,
        height,
        background: color,
        opacity: on ? 1 : 0,
        verticalAlign: "baseline",
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// A command that types itself out: "$ rewynd hours --month".
// ---------------------------------------------------------------------------

type PromptProps = {
  command: string;
  fontSize: number;
  // Colors: on a bare card we use the card colors; inside a terminal
  // window we use the panel colors.
  textColor?: string; // defaults to the card's dim text color
  delay?: number;
  // Show a blinking cursor at the end once typing finishes.
  cursorAtEnd?: boolean;
};

export const TypedPrompt: React.FC<PromptProps> = ({ command, fontSize, textColor, delay = 0, cursorAtEnd = false }) => {
  const frame = useCurrentFrame();
  const { theme, font } = useRecap();
  // Only the terminal and tape templates "type commands". On a receipt or an
  // arcade screen a shell prompt would break the illusion, so it's left out.
  const noPrompt = useContext(NoPrompt);
  if (theme.template === "receipt" || theme.template === "arcade" || noPrompt) return null;
  const tape = theme.template === "tape";
  const inPanel = useContext(InPanel);
  const color = textColor ?? (inPanel ? theme.panelDim : theme.dim);
  // About 1.5 characters per frame: fast enough to finish in under a
  // second, slow enough to read as typing.
  const typed = Math.max(0, Math.floor((frame - delay) * 1.5));
  const done = typed >= command.length;

  return (
    <div
      style={{
        fontFamily: font.ui,
        // VT323 is a bitmap-style font: it runs small, so it gets a size bump.
        fontSize: tape ? fontSize * 1.25 : fontSize,
        fontWeight: tape ? 400 : 700,
        color,
        whiteSpace: "nowrap",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: "0.4em",
      }}
    >
      {/* Terminal: a "$" prompt in the accent color. Tape: a ▶ play mark. */}
      <span style={{ color: theme.accent, fontWeight: 900 }}>{tape ? "▶" : "$"}</span>
      <span>
        {command.slice(0, typed)}
        {/* While typing, the cursor rides at the end of the text. */}
        {!done || cursorAtEnd ? <Cursor color={color} width="0.45em" height="0.9em" /> : null}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Terminal window.
// ---------------------------------------------------------------------------

type WindowProps = {
  title: string; // shown in the title bar, e.g. "~/rewynd — zsh"
  width: number;
  delay?: number;
  children: React.ReactNode;
};

export const TerminalWindow: React.FC<WindowProps> = ({ title, width, delay = 0, children }) => {
  const frame = useCurrentFrame();
  const { theme, font, s } = useRecap();
  const { fps } = useVideoConfig();
  // The window pops open: a quick scale-up from 94% with a little settle.
  const open = spring({ frame: frame - delay, fps, config: { damping: 15, mass: 0.6 } });

  // Only the TAPE template draws a window here. In the terminal template the
  // whole card already is a window; on a receipt or arcade screen the output
  // prints straight onto the paper / screen.
  if (theme.template !== "tape") {
    return (
      <div style={{ width, opacity: interpolate(open, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) }}>
        <NoPrompt.Provider value={theme.template === "terminal"}>
          <InPanel.Provider value={true}>{children}</InPanel.Provider>
        </NoPrompt.Provider>
      </div>
    );
  }

  return (
    <div
      style={{
        width,
        background: theme.panel,
        color: theme.panelFg,
        border: `${3 * s}px solid ${theme.panelBorder}`,
        borderRadius: 22 * s,
        overflow: "hidden",
        fontFamily: font.family,
        boxShadow: theme.hardShadow,
        scale: interpolate(open, [0, 1], [0.94, 1]),
        opacity: interpolate(open, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
      }}
    >
      {/* Title bar: the three window dots, then the title in the middle. */}
      <div
        style={{
          height: 64 * s,
          display: "flex",
          alignItems: "center",
          padding: `0 ${24 * s}px`,
          borderBottom: `${3 * s}px solid ${theme.panelBorder === theme.panel ? "#2A2A2A" : theme.panelBorder}`,
          position: "relative",
        }}
      >
        {[theme.rec, theme.amber, theme.add].map((c) => (
          <span key={c} style={{ width: 20 * s, height: 20 * s, borderRadius: 10 * s, background: c, marginRight: 12 * s }} />
        ))}
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 34 * s,
            fontFamily: font.ui,
            color: theme.panelDim,
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ padding: `${28 * s}px ${36 * s}px ${34 * s}px` }}>
        <InPanel.Provider value={true}>{children}</InPanel.Provider>
      </div>
    </div>
  );
};
