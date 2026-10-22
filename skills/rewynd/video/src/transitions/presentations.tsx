// The transitions BETWEEN scenes (built on @remotion/transitions).
//
// Instead of a hard cut, two scenes overlap for ~0.5–0.9 s and one morphs
// into the next. Each presentation gets `presentationProgress` (0 → 1, already
// eased by its timing) and draws the EXITING or the ENTERING scene.
//
//   colorMorph     big moments (into the personality reveal, into the outro):
//                  a disc in the accent color grows from the middle until it
//                  floods the screen, then the next card opens through a
//                  growing circle, settling from a slight zoom. The shape
//                  "becomes" the next card.
//   tapeRoll       TAPE signature: the picture loses vertical hold and rolls
//                  down while the next one rolls in from the top, through
//                  VHS noise, with a ◀◀ flashing in the middle.
//   push           TERMINAL / RECEIPT signature: output scrolls up (terminal)
//                  or the receipt feeds out of the top while the next prints
//                  in from the bottom (receipt, with a little paper tilt).
//   pixelDissolve  ARCADE signature: the screen fills with pixel blocks in a
//                  random order, then they clear to reveal the next screen.
//
// Only transform / opacity / clip-path animate (cheap to render), and
// randomness is seeded so every render is identical.

import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { CLAMP, EASE_IN_OUT, EASE_OUT } from "../components/motion";
import { RewindIcon } from "../tape/Icons";

// Every presentation is returned with the same loose type, so the video can
// pick one per scene (a union of differently-typed presentations doesn't fit
// <TransitionSeries.Transition>'s single type parameter).
type AnyPresentation = TransitionPresentation<Record<string, unknown>>;
const present = <P extends Record<string, unknown>>(
  component: React.FC<TransitionPresentationComponentProps<P>>,
  props: P,
): AnyPresentation => ({ component, props }) as unknown as AnyPresentation;

// ---------------------------------------------------------------------------
// colorMorph
// ---------------------------------------------------------------------------

type MorphProps = { color: string; at: string };

const ColorMorph: React.FC<TransitionPresentationComponentProps<MorphProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps: { color, at },
}) => {
  if (presentationDirection === "exiting") {
    // The old card leans in a touch as the color swallows it.
    return <AbsoluteFill style={{ scale: interpolate(p, [0, 0.5], [1, 1.04], CLAMP) }}>{children}</AbsoluteFill>;
  }
  // Phase 1 (0 → 0.5): the accent disc grows to cover everything.
  const cover = interpolate(p, [0, 0.5], [0, 80], { ...CLAMP, easing: EASE_IN_OUT });
  // Phase 2 (0.42 → 1): the new card opens through a growing circle, from the
  // same point, settling from 108% so it feels like it came out of the shape.
  const reveal = interpolate(p, [0.42, 1], [0, 80], { ...CLAMP, easing: EASE_OUT });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: color, clipPath: `circle(${cover}% at ${at})` }} />
      <AbsoluteFill style={{ clipPath: `circle(${reveal}% at ${at})`, scale: interpolate(p, [0.42, 1], [1.08, 1], CLAMP) }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const colorMorph = (props: MorphProps) => present(ColorMorph, props);

// ---------------------------------------------------------------------------
// tapeRoll
// ---------------------------------------------------------------------------

const TapeRoll: React.FC<TransitionPresentationComponentProps<{ seed: string }>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps: { seed },
}) => {
  const frame = useCurrentFrame();
  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill style={{ translate: `0 ${p * 100}%`, filter: `brightness(${1 + p * 0.8})` }}>{children}</AbsoluteFill>
    );
  }
  // Tracking noise peaks in the middle of the roll.
  const noise = Math.sin(Math.PI * p);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ translate: `0 ${(p - 1) * 100}%` }}>{children}</AbsoluteFill>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${random(`${seed}-roll-${i}-${frame}`) * 100}%`,
            height: 6 + random(`${seed}-rh-${i}-${frame}`) * 22,
            background: "rgba(255,255,255,0.8)",
            opacity: noise,
          }}
        />
      ))}
      {/* The rewind mark flashes as the tape rolls past. */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: noise > 0.6 ? 1 : 0 }}>
        <div style={{ filter: "drop-shadow(6px 6px 0 rgba(0,0,0,0.5))" }}>
          <RewindIcon size={220} color="#FFFFFF" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const tapeRoll = (seed: string) => present(TapeRoll, { seed });

// ---------------------------------------------------------------------------
// push (terminal scroll / receipt feed)
// ---------------------------------------------------------------------------

type PushProps = { tilt: number };

const Push: React.FC<TransitionPresentationComponentProps<PushProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps: { tilt },
}) =>
  presentationDirection === "exiting" ? (
    <AbsoluteFill style={{ translate: `0 ${-p * 100}%`, rotate: `${-tilt * p}deg` }}>{children}</AbsoluteFill>
  ) : (
    <AbsoluteFill style={{ translate: `0 ${(1 - p) * 100}%`, rotate: `${tilt * (1 - p)}deg` }}>{children}</AbsoluteFill>
  );

/** Terminal: output scrolls up, no tilt. Receipt: paper feeds with a tilt. */
export const push = (tilt = 0) => present(Push, { tilt });

// ---------------------------------------------------------------------------
// pixelDissolve
// ---------------------------------------------------------------------------

type PixelProps = { color: string; seed: string };

const PixelDissolve: React.FC<TransitionPresentationComponentProps<PixelProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps: { color, seed },
}) => {
  const { width, height } = useVideoConfig();
  if (presentationDirection === "exiting") return <>{children}</>;
  // ~90px blocks, whatever the format.
  const cols = Math.round(width / 90);
  const rows = Math.round(height / 90);
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Each block has its own moment: it appears somewhere in the first half
      // and disappears at the same point in the second half.
      const t = random(`${seed}-px-${x}-${y}`) * 0.5;
      if (p < t || p >= t + 0.5) continue;
      cells.push(
        <div
          key={`${x}-${y}`}
          style={{ position: "absolute", left: `${(x / cols) * 100}%`, top: `${(y / rows) * 100}%`, width: `${100 / cols + 0.1}%`, height: `${100 / rows + 0.1}%`, background: color }}
        />,
      );
    }
  }
  return (
    <AbsoluteFill>
      {/* The next screen only shows once the blocks start clearing. */}
      <AbsoluteFill style={{ opacity: p >= 0.5 ? 1 : 0 }}>{children}</AbsoluteFill>
      {cells}
    </AbsoluteFill>
  );
};

export const pixelDissolve = (props: PixelProps) => present(PixelDissolve, props);
