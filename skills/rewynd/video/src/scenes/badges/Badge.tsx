// The enamel-pin badge for each coder personality, drawn as SVG.
//
// Every personality shares one design (so they read as a set) and changes
// three things: the enamel "sky" color, the icon in the middle, and what the
// little terminal at the bottom says. The 3AM Shipper's moon-and-terminal
// pin was the reference.
//
// Why SVG and not images: it stays sharp at any size, it can animate (the
// icons move a little, the cursor blinks), and it uses our palette.
//
// The pin is built in layers, back to front:
// 1. a drop shadow (makes it look like a physical pin on the card)
// 2. the metal rim (off-white with an ink outline)
// 3. the enamel sky inside the rim
// 4. the personality's icon
// 5. a mini terminal window with a prompt and a blinking cursor
// 6. a glint across the rim (shiny enamel)

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { PersonalityId } from "../../../../contract/recap";
import { useIsStill } from "../../components/still";
import { colors } from "../../theme";

const ink = colors.ink;

// The pin's outline: straight sides with a half-circle top (an arch), sized
// for a 420×520 box. `inset` shrinks it to draw the inner enamel area.
const archPath = (inset: number) => {
  const left = 20 + inset;
  const right = 400 - inset;
  const bottom = 500 - inset;
  const r = (right - left) / 2;
  const top = 20 + inset + r; // where the curve meets the straight sides
  return `M ${left} ${bottom} L ${left} ${top} A ${r} ${r} 0 0 1 ${right} ${top} L ${right} ${bottom} Z`;
};

// A four-point sparkle centered on (x, y). `r` is its radius.
const sparkle = (x: number, y: number, r: number) =>
  `M ${x} ${y - r} Q ${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q ${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q ${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q ${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`;

// ---------------------------------------------------------------------------
// Icons. Each draws in the pin's upper area, centered around (210, 190).
// `t` is time in seconds, for small idle motion.
// ---------------------------------------------------------------------------

type Icon = (t: number) => React.ReactNode;

const stroke = { stroke: ink, strokeWidth: 6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const icons: Record<PersonalityId, Icon> = {
  // Crescent moon and twinkling stars.
  "3am-shipper": (t) => (
    <g>
      <circle cx={250} cy={170} r={68} fill={colors.amber} {...stroke} />
      <circle cx={282} cy={146} r={58} fill="#A5A0FF" />
      <path d="M 196 128 A 58 58 0 0 0 318 191" fill="none" {...stroke} />
      {[
        [120, 150, 26, 5, 0],
        [170, 240, 14, 7, 1.3],
        [330, 260, 18, 6, 2.1],
        [110, 270, 10, 8, 0.7],
      ].map(([x, y, r, speed, phase], i) => (
        <path key={i} d={sparkle(x, y, r * (0.75 + 0.25 * Math.sin(t * speed + phase)))} fill={colors.paper} strokeWidth={4} stroke={ink} />
      ))}
    </g>
  ),
  // Two arrows chasing each other in a circle: rewrite, again.
  rewriter: (t) => (
    <g transform={`rotate(${t * 40} 210 190)`}>
      <path d="M 140 190 A 70 70 0 0 1 270 150" fill="none" stroke={ink} strokeWidth={30} strokeLinecap="round" />
      <path d="M 140 190 A 70 70 0 0 1 270 150" fill="none" stroke={colors.paper} strokeWidth={18} strokeLinecap="round" />
      <path d="M 280 190 A 70 70 0 0 1 150 230" fill="none" stroke={ink} strokeWidth={30} strokeLinecap="round" />
      <path d="M 280 190 A 70 70 0 0 1 150 230" fill="none" stroke={colors.paper} strokeWidth={18} strokeLinecap="round" />
      <path d="M 250 118 L 296 146 L 254 178 Z" fill={colors.paper} {...stroke} />
      <path d="M 170 262 L 124 234 L 166 202 Z" fill={colors.paper} {...stroke} />
    </g>
  ),
  // A heart that beats.
  "polite-one": (t) => (
    <g transform={`translate(210 190) scale(${1 + 0.06 * Math.max(0, Math.sin(t * 7))}) translate(-210 -190)`}>
      <path d="M 210 270 C 120 210 120 120 180 120 C 200 120 210 135 210 145 C 210 135 220 120 240 120 C 300 120 300 210 210 270 Z" fill={colors.del} {...stroke} />
      <path d="M 165 150 C 158 160 158 172 162 180" fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" opacity={0.8} />
    </g>
  ),
  // A lightning bolt with speed lines.
  speedrunner: (t) => (
    <g>
      {[0, 1, 2].map((i) => (
        <line key={i} x1={96 + ((t * 120 + i * 30) % 40)} y1={150 + i * 40} x2={140 + ((t * 120 + i * 30) % 40)} y2={150 + i * 40} stroke={ink} strokeWidth={8} strokeLinecap="round" />
      ))}
      <path d="M 236 100 L 160 205 L 208 205 L 186 285 L 268 170 L 218 170 Z" fill={colors.amber} {...stroke} />
    </g>
  ),
  // A friendly bug whose legs wiggle.
  "bug-whisperer": (t) => {
    const wiggle = Math.sin(t * 9) * 6;
    return (
      <g>
        {[150, 190, 230].map((y, i) => (
          <g key={y}>
            <line x1={170} y1={y} x2={128} y2={y - 14 + (i % 2 ? wiggle : -wiggle)} {...stroke} />
            <line x1={250} y1={y} x2={292} y2={y - 14 + (i % 2 ? -wiggle : wiggle)} {...stroke} />
          </g>
        ))}
        <line x1={196} y1={112} x2={180} y2={88} {...stroke} />
        <line x1={224} y1={112} x2={240} y2={88} {...stroke} />
        <circle cx={210} cy={122} r={26} fill={ink} />
        <ellipse cx={210} cy={194} rx={52} ry={70} fill={colors.add} {...stroke} />
        <line x1={210} y1={130} x2={210} y2={262} {...stroke} />
        <circle cx={188} cy={180} r={9} fill={ink} />
        <circle cx={232} cy={214} r={9} fill={ink} />
      </g>
    );
  },
  // A drafting triangle over blueprint grid lines.
  architect: () => (
    <g>
      {[110, 150, 190, 230, 270].map((v) => (
        <g key={v} opacity={0.35}>
          <line x1={90} y1={v} x2={330} y2={v} stroke={colors.paper} strokeWidth={3} />
          <line x1={v + 20} y1={90} x2={v + 20} y2={290} stroke={colors.paper} strokeWidth={3} />
        </g>
      ))}
      <path d="M 130 270 L 130 110 L 290 270 Z" fill={colors.amber} {...stroke} />
      <path d="M 160 240 L 160 180 L 220 240 Z" fill="#9BC4FF" {...stroke} />
    </g>
  ),
  // Three balls in the air, moving along an arc.
  juggler: (t) => (
    <g>
      {[colors.rec, colors.amber, colors.add].map((c, i) => {
        const a = t * 3 + (i * Math.PI * 2) / 3;
        return <circle key={c} cx={210 + Math.cos(a) * 80} cy={190 - Math.abs(Math.sin(a)) * 70 + 20} r={30} fill={c} {...stroke} />;
      })}
    </g>
  ),
  // A stopwatch whose hand keeps going.
  marathoner: (t) => (
    <g>
      <rect x={192} y={86} width={36} height={26} rx={6} fill={colors.paper} {...stroke} />
      <circle cx={210} cy={200} r={86} fill={colors.paper} {...stroke} />
      <circle cx={210} cy={200} r={66} fill="none" stroke={ink} strokeWidth={3} strokeDasharray="4 18" />
      <line x1={210} y1={200} x2={210 + Math.sin(t * 2) * 56} y2={200 - Math.cos(t * 2) * 56} stroke={colors.rec} strokeWidth={8} strokeLinecap="round" />
      <circle cx={210} cy={200} r={10} fill={ink} />
    </g>
  ),
  // A sun with slowly turning rays.
  "weekend-warrior": (t) => (
    <g>
      <g transform={`rotate(${t * 20} 210 190)`}>
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={202} y={86} width={16} height={36} rx={6} fill={colors.amber} {...stroke} transform={`rotate(${i * 45} 210 190)`} />
        ))}
      </g>
      <circle cx={210} cy={190} r={58} fill={colors.amber} {...stroke} />
      <path d="M 186 196 Q 210 222 234 196" fill="none" {...stroke} />
      <circle cx={190} cy={176} r={7} fill={ink} />
      <circle cx={230} cy={176} r={7} fill={ink} />
    </g>
  ),
};

// Enamel color and terminal text for each personality.
const looks: Record<PersonalityId, { sky: string; prompt: string }> = {
  "3am-shipper": { sky: "#A5A0FF", prompt: "> ship it" },
  rewriter: { sky: "#8FA2FF", prompt: "> rm -rf v1" },
  "polite-one": { sky: "#FFC2BD", prompt: "> thanks!" },
  speedrunner: { sky: "#9EE8C0", prompt: "> done." },
  "bug-whisperer": { sky: "#C9F0D9", prompt: "> fixed?" },
  architect: { sky: "#6F8FE8", prompt: "> plan.md" },
  juggler: { sky: "#FFE1A3", prompt: "> 5 tabs" },
  marathoner: { sky: "#C9C6FF", prompt: "> still here" },
  "weekend-warrior": { sky: "#9AD8FF", prompt: "> sat 10am" },
};

export const Badge: React.FC<{ personality: PersonalityId }> = ({ personality }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const still = useIsStill();
  const t = frame / fps;
  const look = looks[personality] ?? looks["3am-shipper"];
  const icon = icons[personality] ?? icons["3am-shipper"];
  // Classic terminal cursor: on for half a second, off for half a second.
  const cursorOn = still || Math.floor(frame / (fps / 2)) % 2 === 0;
  // Cursor sits right after the prompt. Inter Black averages ~0.58em per
  // character at this size, which is close enough for a short prompt.
  const fontSize = 34;
  const cursorX = 24 + look.prompt.length * fontSize * 0.56;

  return (
    <svg viewBox="0 0 420 520" width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        {/* Keeps icons from poking outside the enamel area. */}
        <clipPath id={`sky-${personality}`}>
          <path d={archPath(26)} />
        </clipPath>
      </defs>
      {/* 1. Drop shadow. */}
      <path d={archPath(0)} fill={ink} transform="translate(12 14)" />
      {/* 2. Metal rim. */}
      <path d={archPath(0)} fill={colors.paper} stroke={ink} strokeWidth={10} strokeLinejoin="round" />
      {/* 3. Enamel sky. */}
      <path d={archPath(26)} fill={look.sky} stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      {/* 4. Icon. */}
      <g clipPath={`url(#sky-${personality})`}>{icon(t)}</g>
      {/* 5. Mini terminal. */}
      <g transform="translate(60 310)">
        <rect x={0} y={0} width={300} height={150} rx={18} fill={ink} />
        <circle cx={28} cy={26} r={9} fill={colors.rec} />
        <circle cx={56} cy={26} r={9} fill={colors.amber} />
        <circle cx={84} cy={26} r={9} fill={colors.add} />
        <text x={24} y={106} fill={colors.paper} fontSize={fontSize} fontWeight={900} fontFamily="inherit" letterSpacing="-0.01em">
          {look.prompt}
        </text>
        {cursorOn ? <rect x={Math.min(cursorX, 268)} y={76} width={18} height={36} fill={colors.add} /> : null}
      </g>
      {/* 6. Glint. */}
      <path d="M 60 170 A 150 150 0 0 1 130 72" fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" opacity={0.85} />
    </svg>
  );
};
