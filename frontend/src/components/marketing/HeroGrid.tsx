"use client";

import { useEffect, useRef } from "react";

/**
 * The drafting grid behind the hero. Moving the cursor across it fills the
 * cells it passes through, which fade out behind it like a drawn line.
 *
 * Whole cells rather than a soft radius: on a drafting grid the square is the
 * unit, and a glow that half-lit four of them at once read as a smudge over
 * the paper instead of as something happening to it. Snapping to the cell
 * also means the effect lands exactly on the lines already drawn, so it looks
 * like the grid lighting up rather than a shape floating above it.
 *
 * The fill sits *under* the hairlines, so the lines stay crisp across a lit
 * cell. It is sage at 28% -- the tint has to survive being spread over
 * 64x64px, which is a lot of area, and anything stronger turns the paper into
 * a chequerboard and makes the headline sitting on it harder to read.
 *
 * No React state: the cells are a fixed pool of spans, moved with transforms
 * and faded with the Web Animations API, so drawing across the hero at speed
 * never re-renders the tree.
 */

/** Cell size. The grid, the snap and the fill all derive from this one number. */
const CELL = 64;

/** Enough squares to cover the longest fast swipe before the first recycles. */
const POOL = 18;

const FADE_MS = 900;

/** Peak opacity of a lit cell. The one number to turn if it is too much. */
const PEAK = 0.28;

/** The grid itself: one hairline down, one across. */
const LINES =
  "linear-gradient(to right, rgb(var(--rule)) 1px, transparent 1px)," +
  "linear-gradient(to bottom, rgb(var(--rule)) 1px, transparent 1px)";

/* The grid was always faded out towards the foot of the section so it reads
   as paper rather than as decoration. Carried on the wrapper so it applies to
   the lit cells too -- otherwise the cursor would light squares in the dead
   zone where no grid is drawn. */
// #000 is the mask's own colour and has nothing to do with the palette: a
// mask reads opacity, not hue, so this stays fixed in both themes.
const FADE = "radial-gradient(120% 90% at 50% 0%, #000 30%, transparent 75%)";

export function HeroGrid() {
  const trail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = trail.current;
    if (!host) return;

    // Nothing to follow on a touch screen, and a tap synthesises a single
    // mousemove that would strand one lit square wherever it landed.
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cells = Array.from(host.children) as HTMLElement[];
    let next = 0;
    let lastCell = "";
    let frame = 0;
    let clientX = 0;
    let clientY = 0;

    function paint() {
      frame = 0;

      // One layout read per frame, not one per mousemove event.
      const box = host!.getBoundingClientRect();
      const x = clientX - box.left;
      const y = clientY - box.top;
      if (x < 0 || y < 0 || x > box.width || y > box.height) return;

      const col = Math.floor(x / CELL);
      const row = Math.floor(y / CELL);
      const cell = `${col}:${row}`;
      // Moving within a square is not an event. Without this the same cell is
      // relit on every frame and never gets to fade.
      if (cell === lastCell) return;
      lastCell = cell;

      const el = cells[next];
      next = (next + 1) % cells.length;

      // The pool recycles, so a square may still be finishing its last fade.
      el.getAnimations().forEach((animation) => animation.cancel());
      el.style.transform = `translate3d(${col * CELL}px, ${row * CELL}px, 0)`;
      el.animate([{ opacity: PEAK }, { opacity: 0 }], {
        duration: FADE_MS,
        easing: "ease-out",
        fill: "forwards",
      });
    }

    function onMove(event: MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
    >
      {/* the lit cells, beneath the lines */}
      <div ref={trail} className="absolute inset-0">
        {Array.from({ length: POOL }).map((_, index) => (
          <span
            key={index}
            className="absolute left-0 top-0 block opacity-0"
            style={{
              width: CELL,
              height: CELL,
              backgroundColor: "rgb(var(--sage))",
              willChange: "transform, opacity",
            }}
          />
        ))}
      </div>

      {/* the paper */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{ backgroundImage: LINES, backgroundSize: `${CELL}px ${CELL}px` }}
      />
    </div>
  );
}
