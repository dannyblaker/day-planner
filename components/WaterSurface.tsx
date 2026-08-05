"use client";

import { useEffect, useState } from "react";

/**
 * How often something disturbs the water: a gap of five to seventeen seconds, then
 * one ring, then quiet again. The point is that it is *rare*. Continuous motion
 * under something you read all day is tiring, which is why the pool itself holds
 * still, and a ripple every couple of seconds would be the same mistake in a
 * smaller font.
 */
const GAP_MS = 5000;
const GAP_SPREAD_MS = 12000;
/** must outlast the `croc-ripple` animation in globals.css */
const LIFE_MS = 3000;

interface Drop {
  id: number;
  /** where, as a percentage of the pool */
  x: number;
  y: number;
  /** how big a thing fell in */
  size: number;
}

/**
 * The pool: a still, lit surface (all of it in globals.css) with the odd ripple
 * crossing it.
 *
 * The ripples are elements rather than another animated layer because that is the
 * cheap way round: one ring 100px across, scaling and fading on the compositor,
 * costs nothing next to repainting the whole surface every frame — and between them
 * there is no animation running at all.
 *
 * Whether the canvas is water at all lives in `data-canvas` on <html>, not in
 * React, so this checks the attribute when it is about to drop one rather than
 * subscribing to anything. Same for reduced motion: asked, not assumed.
 */
export default function WaterSurface() {
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let next: ReturnType<typeof setTimeout>;
    let seq = 0;
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        schedule(GAP_MS + Math.random() * GAP_SPREAD_MS);
        // nothing to see: don't spend the frames
        if (document.hidden) return;
        if (document.documentElement.dataset.canvas !== "water") return;

        const drop: Drop = {
          id: (seq += 1),
          x: 6 + Math.random() * 88,
          y: 6 + Math.random() * 88,
          size: 70 + Math.random() * 90,
        };
        setDrops((d) => [...d, drop]);
        setTimeout(
          () => setDrops((d) => d.filter((o) => o.id !== drop.id)),
          LIFE_MS
        );
      }, delay);
    };
    schedule(GAP_MS + Math.random() * GAP_SPREAD_MS);
    return () => clearTimeout(next);
  }, []);

  return (
    <div className="croc-surface" aria-hidden="true">
      {drops.map((d) => (
        <span
          key={d.id}
          className="croc-ripple"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            ["--ripple-size" as string]: `${Math.round(d.size)}px`,
          }}
        />
      ))}
    </div>
  );
}
