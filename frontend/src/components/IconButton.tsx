import type { LucideIcon } from "lucide-react";

/**
 * An action with no words on it.
 *
 * A labelled action costs a row half its width, and in a list the same word
 * repeats down the page saying nothing new. An icon costs nothing until it is
 * needed -- but only if it can be asked what it does, so the label is not
 * optional here. It is the accessible name and the tooltip both, and there is
 * no way to construct one of these without it.
 *
 * Round, and the only round thing in a list of square ones. That is the rule
 * the interface follows: surfaces are drawn square, because the product is
 * about drawings on paper, and the things you press are round, because they
 * are not part of the drawing. A circle in a column of rectangles reads as a
 * control from across the room.
 *
 * `title` is deliberately not used. The native tooltip takes a second to
 * appear, cannot be styled, and never shows for a keyboard user.
 */
export function IconButton({
  label,
  icon: Icon,
  href,
  onClick,
  newTab = false,
  tone = "quiet",
}: {
  /** What this does, in two or three words. Shown on hover, read aloud. */
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  newTab?: boolean;
  tone?: "quiet" | "brand";
}) {
  const face =
    tone === "brand"
      ? "border-brand bg-brand text-paper hover:bg-brandDark"
      : "border-rule bg-card text-muted hover:border-brand hover:text-ink";

  const inner = (
    <>
      {/* The ring is 34px and the target is 44px: a thumb gets the whole
          square, the eye only ever sees the circle. The focus ring is moved
          onto the circle for the same reason -- the page-wide outline would
          have drawn a 44px square around a 34px button. */}
      <span
        aria-hidden
        className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border
                    transition-colors duration-150 group-focus-visible:ring-2
                    group-focus-visible:ring-brand group-focus-visible:ring-offset-2
                    group-focus-visible:ring-offset-card ${face}`}
      >
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden
                   whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[0.75rem]
                   leading-none text-paper shadow-menu
                   group-hover:block group-focus-visible:block"
      >
        {label}
      </span>
    </>
  );

  const frame =
    "group relative inline-flex h-11 w-11 shrink-0 items-center justify-center " +
    "focus-visible:outline-none";

  if (href) {
    return (
      <a
        href={href}
        aria-label={label}
        className={frame}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={frame}>
      {inner}
    </button>
  );
}
