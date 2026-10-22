// RECEIPT template, hand-designed cards (mockup "C · Receipt").
// The frame already prints the REWYND header; these fill the paper below it.
// Space Mono, black ink, base size 15px × 2 = 30px.

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Appear } from "../../components/Appear";
import { CLAMP, SPRING } from "../../components/motion";
import { useRecap } from "../../recap/context";
import { TapeCard } from "../../tape/TapeCard";
import { TermList } from "../../tape/TermList";
import { Rule } from "../frames/Receipt";
import { Fill, Ticker, useCardData } from "./shared";

/** "LABEL ............ VALUE" without the dots: label left, bold value right. */
const Row: React.FC<{ label: string; value: React.ReactNode; delay: number; big?: boolean }> = ({ label, value, delay, big }) => (
  <Appear delay={delay} distance={0}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: big ? 40 : 30, lineHeight: 1.5 }}>
      <span style={{ fontWeight: big ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  </Appear>
);

const Center: React.FC<{ children: React.ReactNode; delay: number; dim?: boolean }> = ({ children, delay, dim }) => {
  const { theme } = useRecap();
  return (
    <Appear delay={delay} distance={0}>
      <div style={{ textAlign: "center", fontSize: 26, letterSpacing: 4, color: dim ? theme.dim : theme.fg }}>{children}</div>
    </Appear>
  );
};

/** Decorative barcode that "prints" left to right. */
const Barcode: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const { theme } = useRecap();
  const widths = [3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 1, 1, 4, 1, 2, 1, 3, 2, 1, 1, 3];
  const shown = Math.round(interpolate(frame, [delay, delay + 12], [0, widths.length], CLAMP));
  return (
    <div aria-hidden="true" style={{ display: "flex", gap: 6, justifyContent: "center", height: 112 }}>
      {widths.map((w, i) => (
        <div key={i} style={{ width: w * 2, height: 112, background: theme.fg, opacity: i < shown ? 1 : 0 }} />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------

export const ReceiptHours: React.FC = () => {
  const { font } = useRecap();
  const d = useCardData();
  const rows: [string, string][] = [
    ["SESSIONS", d.fmt(d.sessions)],
    ["AGENTS USED", String(d.agentCount)],
    ["LATE NIGHTS", d.fmt(d.lateNight)],
    ["LONGEST STREAK", `${d.streak} D`],
  ];
  if (d.vsPrev !== null && d.prevShort) rows.push([`VS ${d.prevShort === "SEP" ? "SEPTEMBER" : d.prevShort}`, `${d.vsPrev >= 0 ? "+" : ""}${d.vsPrev}%`]);
  return (
    <TapeCard>
      <Fill>
        {rows.map(([l, v], i) => (
          <Row key={l} label={l} value={v} delay={8 + i * 3} />
        ))}
        <Rule />
        <Appear delay={24} distance={0}>
          <div style={{ fontSize: 30 }}>TOTAL HOURS WITH AI</div>
        </Appear>
        <div style={{ fontFamily: font.hero, fontWeight: 700, fontSize: 216, lineHeight: 1, letterSpacing: -12, marginTop: 8 }}>
          <Ticker value={d.hoursOneDecimal} delay={26} decimals={1} />
        </div>
        <Appear delay={40} distance={0}>
          <div style={{ fontSize: 30, marginTop: 12 }}>= {d.fullDays} FULL DAYS</div>
        </Appear>
        <Rule />
        <Barcode delay={46} />
        <div style={{ marginTop: 24 }}>
          <Center delay={58}>THANK YOU FOR SHIPPING</Center>
        </div>
      </Fill>
    </TapeCard>
  );
};

// ---------------------------------------------------------------------------
// Top tools
// ---------------------------------------------------------------------------

export const ReceiptTools: React.FC = () => {
  const { theme, font } = useRecap();
  const d = useCardData();
  return (
    <TapeCard>
      <Fill>
        <Center delay={4}>ITEMIZED · TOP TOOLS</Center>
        <Center delay={6} dim>
          {(d.agentNames.join(" + ") || "YOUR AGENTS").toUpperCase()}
        </Center>
        <Rule margin={28} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: theme.dim, marginBottom: 16 }}>
          <span>QTY ITEM</span>
          <span>CALLS</span>
        </div>
        <TermList rows={d.tools.map((t) => ({ key: t.key, name: t.name, value: d.fmt(t.count) }))} width={720} delay={12} />
        <Rule margin={32} />
        <Row label="SUBTOTAL" value={d.fmt(d.top5Sum)} delay={36} />
        <Row label="OTHER TOOLS" value={d.fmt(d.otherCalls)} delay={39} />
        <Appear delay={42} distance={0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 20 }}>
            <span style={{ fontWeight: 700, fontSize: 40 }}>TOTAL</span>
            <span style={{ fontFamily: font.hero, fontWeight: 700, fontSize: 128, lineHeight: 1, letterSpacing: -6 }}>
              <Ticker value={d.toolCalls} delay={42} />
            </span>
          </div>
        </Appear>
        <Rule />
        <Center delay={56}>MOST BOUGHT: {(d.tools[0]?.name ?? "NOTHING YET").toUpperCase()}</Center>
        <Center delay={60}>NO REFUNDS ON DELETED CODE</Center>
      </Fill>
    </TapeCard>
  );
};

// ---------------------------------------------------------------------------
// Personality: the certified stamp
// ---------------------------------------------------------------------------

export const ReceiptPersonality: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme } = useRecap();
  const d = useCardData();
  // The stamp SLAMS down: from 160% to 100% on a snappy spring, ending tilted.
  const slam = spring({ frame: frame - 26, fps, config: SPRING.snappy });
  const title = d.personalityTitle.toUpperCase().replace(/^THE /, "THE ");
  const rows: [string, string][] = [
    ["PEAK HOUR", d.peakAmPm],
    ["NIGHT SESSIONS", d.fmt(d.lateNight)],
    d.aiShare !== null ? ["COMMITS WITH AI", `${d.aiShare}%`] : ["LONGEST SESSION", `${d.longestHours ?? 0} H`],
  ];
  return (
    <TapeCard>
      <Fill>
        <Center delay={4}>CUSTOMER PROFILE · {d.periodTape}</Center>
        <Rule margin={28} />
        {rows.map(([l, v], i) => (
          <Row key={l} label={l} value={v} delay={8 + i * 3} />
        ))}
        <Rule />
        <Appear delay={18} distance={0}>
          <div style={{ fontSize: 26, color: theme.dim }}>CUSTOMER TYPE</div>
        </Appear>
        <div
          style={{
            margin: "44px 0 52px",
            alignSelf: "center",
            rotate: "-7deg",
            border: `10px solid ${theme.stamp}`,
            color: theme.stamp,
            borderRadius: 20,
            padding: "24px 36px",
            textAlign: "center",
            scale: interpolate(slam, [0, 1], [1.6, 1]),
            opacity: interpolate(slam, [0, 0.2], [0, 0.95], CLAMP),
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: 6 }}>CERTIFIED</div>
          <div style={{ fontWeight: 700, fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
        </div>
        <Appear delay={40} distance={0}>
          <div style={{ fontSize: 30, lineHeight: 1.5 }}>NOTE: {d.personalityLine}</div>
        </Appear>
        <Rule />
        <Center delay={48}>COME BACK NEXT MONTH</Center>
      </Fill>
    </TapeCard>
  );
};
