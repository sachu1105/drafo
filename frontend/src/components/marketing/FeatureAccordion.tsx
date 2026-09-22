"use client";

import Image from "next/image";
import { ChevronDown, FileCheck2, FolderOpen, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * What you get, as three panels with the picture that goes with each.
 *
 * Eight items laid out flat gave every one of them the same weight and asked
 * the visitor to read all of it to find the one thing they came for. Here they
 * read three labels, open the one that answers their question, and the panel
 * beside it shows what that actually looks like.
 *
 * The data lives in this file rather than on the page: the rows carry icon
 * components, and a server component cannot hand a function to a client one.
 */
const GROUPS = [
  {
    label: "The record",
    icon: FileCheck2,
    image: "/rivison.png" as string | null,
    imageAlt:
      "A drawing set with revisions 1 to 3 stacked, an approvals list giving "
      + "the date and time each revision was approved, a note, and a client "
      + "comment.",
    items: [
      [
        "Timestamped approvals",
        "Name, date and time at the moment of the tap. Append-only, including for us.",
      ],
      [
        "Revisions keep their history",
        "Revision 3 becomes current; 1 and 2 stay, each with the approval it carried.",
      ],
      [
        "Notes against a revision",
        "Questions stay with the drawing that prompted them.",
      ],
    ],
  },
  {
    label: "The project",
    icon: FolderOpen,
    /** Drop a file in /public and name it here, as "The record" does. */
    image: "/drawing.png" as string | null,
    imageAlt: "",
    items: [
      [
        "Readable on a phone",
        "Every PDF renders to a wide image, legible without pinch-zoom.",
      ],
      [
        "A materials list that survives",
        "Brand, price and a photo. Findable a year later, by both of you.",
      ],
      [
        "Payment milestones",
        "Stages and amounts, visible to your client. A record, not a checkout.",
      ],
    ],
  },
  {
    label: "The link",
    icon: Link2,
    image: "/link.png" as string | null,
    imageAlt: "",
    items: [
      [
        "A link you can kill",
        "Rotate it and the old one stops working immediately.",
      ],
      [
        "Nothing is a public URL",
        "Every file is checked against the link it was opened with.",
      ],
    ],
  },
];

/** How long a panel holds before the next one opens itself. */
const ADVANCE_MS = 7000;

export function FeatureAccordion() {
  // One panel is always open. Letting all three close would leave the picture
  // beside them describing nothing, and drop the column to a third of its
  // height for no gain -- this behaves as tabs that happen to open downwards.
  const [openIndex, setOpenIndex] = useState(0);

  // Content that moves on its own has to be stoppable, and must not run where
  // nobody is looking. Four things can hold the timer:
  //
  //   reduced  the visitor asked for no motion, so it never runs at all
  //   inView   the section is off screen; advancing there only wastes the
  //            panels and lands the visitor mid-rotation when they arrive
  //   paused   a pointer or the keyboard is inside it, so someone is reading
  //   stopped  a panel was chosen by hand -- the visitor is driving now, and
  //            taking it back from them would be the rudest thing here
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const autoplay = !stopped && !reduced;
  const running = autoplay && inView && !paused;
  const active = GROUPS[openIndex];

  function choose(index: number) {
    setStopped(true);
    setOpenIndex(index);
  }

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16"
    >
      <FeatureVisual group={active} />

      <div>
        {GROUPS.map((group, index) => {
          const isOpen = index === openIndex;
          const panelId = `feature-panel-${index}`;
          const buttonId = `feature-button-${index}`;

          return (
            <div key={group.label} className="relative border-t border-rule">
              {/* The rule on the open panel doubles as its timer. When nothing
                  is driving it -- reduced motion, or the visitor has taken
                  over -- it just sits at full width, which is the plain
                  "this one is open" mark it was before. */}
              {isOpen ? (
                <span
                  key={autoplay ? `run-${openIndex}` : "static"}
                  aria-hidden
                  onAnimationEnd={
                    autoplay
                      ? () => setOpenIndex((i) => (i + 1) % GROUPS.length)
                      : undefined
                  }
                  className="absolute -top-px left-0 h-0.5 w-full origin-left bg-brand"
                  style={
                    autoplay
                      ? {
                          animation: `feature-progress ${ADVANCE_MS}ms linear forwards`,
                          animationPlayState: running ? "running" : "paused",
                        }
                      : undefined
                  }
                />
              ) : null}
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => choose(index)}
                  className="flex w-full items-center gap-4 py-5 text-left"
                >
                  <group.icon
                    aria-hidden
                    strokeWidth={1.75}
                    className={`h-6 w-6 shrink-0 transition-colors duration-200 ${
                      isOpen ? "text-brand" : "text-faint"
                    }`}
                  />
                  <span className="flex-1 font-display text-[1.25rem] leading-snug">
                    {group.label}
                  </span>
                  <ChevronDown
                    aria-hidden
                    strokeWidth={1.75}
                    className={`h-5 w-5 shrink-0 text-muted transition-transform
                                duration-200 motion-reduce:transition-none ${
                                  isOpen ? "-rotate-180" : ""
                                }`}
                  />
                </button>
              </h3>

              {/* 0fr -> 1fr rather than a measured height: it animates without
                  reading the DOM, so it cannot land on a stale height when the
                  copy changes. The collapsed panel stays mounted for the
                  transition, so `inert` keeps it out of the tab order and off
                  the accessibility tree while it is closed. */}
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                inert={!isOpen}
                className={`grid transition-[grid-template-rows] duration-200
                            ease-out motion-reduce:transition-none ${
                              isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                            }`}
              >
                <div className="overflow-hidden">
                  <dl className="space-y-5 pb-7">
                    {group.items.map(([title, body]) => (
                      <div key={title}>
                        <dt className="text-[0.9375rem] leading-snug">{title}</dt>
                        <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">
                          {body}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The picture for the open panel.
 *
 * Until there are screenshots this draws the same drafting grid the hero uses,
 * so an empty panel reads as a frame waiting for a drawing rather than as a
 * broken image. Give a group an `image` and this swaps itself out.
 */
function FeatureVisual({ group }: { group: (typeof GROUPS)[number] }) {
  return (
    <div
      data-feature-visual
      className="relative aspect-[3/2] overflow-hidden border border-rule bg-card"
    >
      {group.image ? (
        <Image
          key={group.image}
          src={group.image}
          alt={group.imageAlt}
          fill
          sizes="(min-width: 1024px) 34rem, 100vw"
          className="animate-rise object-contain"
        />
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(to right, #CBD1C0 1px, transparent 1px)," +
                "linear-gradient(to bottom, #CBD1C0 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <p className="absolute inset-0 flex items-center justify-center text-[0.8125rem] text-faint">
            {group.label}
          </p>
        </>
      )}
    </div>
  );
}
