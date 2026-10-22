// A safety net for layout: if its content is taller than the space it's
// given, it scales the content down to fit. Normal data fits without
// scaling; this is for the odd cases we can't predict (a very long caption
// from Claude, five projects with long names, a custom font that runs big).
//
// How it measures: CSS `scale` doesn't change an element's layout size, so
// the content's scrollHeight is its natural height no matter how much it's
// scaled. We compare that with the box's own height once fonts have loaded
// (text measured with a fallback font would be the wrong size; see
// fontsReady() in fonts.ts). Rendering
// is paused with delayRender() until that first measurement is done, so no
// frame is ever captured before the content fits. A ResizeObserver
// re-measures if the content's size changes later.

import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { fontsReady } from "../fonts";

type Props = {
  children: React.ReactNode;
  // Where the content sits when it's shorter than the box.
  align?: "top" | "center";
};

export const FitBox: React.FC<Props> = ({ children, align = "top" }) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  const [handle] = useState(() => delayRender("FitBox: measuring layout"));

  // Returns true once it got a real measurement. When the renderer first
  // mounts the page, the box can briefly have 0 height (layout not done
  // yet); that measurement doesn't count.
  const measure = useCallback((): boolean => {
    if (!outer.current || !inner.current) return false;
    const available = outer.current.clientHeight;
    const needed = inner.current.scrollHeight;
    if (available <= 0) return false;
    // 0.5 is a floor: below that, text would be unreadable anyway.
    const next = needed > available ? Math.max(0.5, available / needed) : 1;
    setK((prev) => (Math.abs(prev - next) > 0.001 ? next : prev));
    return true;
  }, []);

  // Step 1: once fonts are ready, measure (this may set a new scale). If
  // the box has no size yet, the ResizeObserver measures again as soon as
  // it does. Watching both boxes also catches later size changes.
  const [measured, setMeasured] = useState(false);
  useLayoutEffect(() => {
    let alive = true;
    let fontsLoaded = false;
    const attempt = () => {
      if (alive && fontsLoaded && measure()) setMeasured(true);
    };
    fontsReady().then(() => {
      fontsLoaded = true;
      attempt();
    });
    const observer = new ResizeObserver(attempt);
    if (outer.current) observer.observe(outer.current);
    if (inner.current) observer.observe(inner.current);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [measure]);

  // Step 2: release the render only after React has committed the new
  // scale, so the captured frame already fits.
  useLayoutEffect(() => {
    if (measured) continueRender(handle);
  }, [measured, handle]);

  return (
    <div
      ref={outer}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      <div ref={inner} style={{ scale: k, transformOrigin: align === "center" ? "left center" : "left top", flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
};
