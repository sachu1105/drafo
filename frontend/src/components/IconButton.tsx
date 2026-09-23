import type { LucideIcon } from "lucide-react";

/**
 * An action with no words on it.
 *
 * A labelled action costs a row half its width, and in a list the same word
 * repeats down the page saying nothing new. So the label is not written on
 * the button -- but it is still required here, because it is the accessible
 * name and there is no way to construct one of these without it.
 *
 * It used to be drawn as a tooltip on hover as well. Two of these sit side by
 * side at the end of a material row, and the second tooltip opened across the
 * first: a black slab reading "Ed" against "Remove 600x600". Widening them or
 * flipping their alignment only moves which pair collides. A round icon at
 * the end of a row is already understood without being narrated, so the
 * tooltip is gone and the accessible name stays.
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

    </>
  );

  const frame =
    "group inline-flex h-11 w-11 shrink-0 items-center justify-center " +
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
