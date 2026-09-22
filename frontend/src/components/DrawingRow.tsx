import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { DrawingSet } from "@/lib/types";
import { Tick } from "@/components/Tick";

/**
 * One drawing in the client's list.
 *
 * This is the only thing on the page anyone is asked to *do*, and it used to
 * be a line of text with a chevron at the far right of it. On a phone, held
 * by someone who was sent a link on WhatsApp and has never seen this before,
 * nothing about that says "tap here and approve the drawing".
 *
 * So: the drawing itself is shown, and the tap target is a card with a
 * visible action on it. The action is a span, not a button -- the whole card
 * is the link, and a button inside a link is neither.
 */
export function DrawingRow({ set, href }: { set: DrawingSet; href: string }) {
  const version = set.current_version;
  const approval = version?.approval ?? null;
  const awaiting = Boolean(version) && !approval;
  const notes = version?.comment_count ?? 0;

  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 border bg-card p-3 transition-colors
                  duration-150 hover:border-brand sm:gap-5 sm:p-4 ${
                    awaiting ? "border-ink" : "border-rule"
                  }`}
    >
      <Thumbnail url={version?.preview_url ?? null} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[1.125rem] leading-snug sm:text-[1.25rem]">
          {set.title}
        </p>

        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {version ? (
            <>
              Revision {version.version_number}
              <span className="text-faint"> · </span>
              {formatDate(version.uploaded_at)}
            </>
          ) : (
            "Nothing uploaded yet"
          )}
        </p>

        {approval ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] text-accent">
            <Tick />
            Approved {formatDate(approval.approved_at)}
          </p>
        ) : null}

        {/* A note written against this revision lives on the next page, and
            without this there is nothing out here saying so -- the architect
            writes one, the client never opens the drawing, and the note is
            never read. */}
        {notes > 0 ? (
          <p className="mt-1.5 text-[0.8125rem] text-muted">
            {notes === 1 ? "1 note" : `${notes} notes`}
          </p>
        ) : null}

        {/* On a narrow screen the action moves under the text, full width,
            where a thumb actually lands. */}
        {version ? (
          <span
            className={`mt-2.5 inline-flex min-h-[44px] items-center justify-center
                        px-4 text-[0.875rem] font-medium sm:hidden ${
                          awaiting
                            ? "w-full bg-brand text-paper"
                            : "border border-rule text-ink"
                        }`}
          >
            {awaiting ? "Review & approve" : "View"}
          </span>
        ) : null}
      </div>

      {version ? (
        <span
          className={`hidden min-h-[44px] shrink-0 items-center justify-center px-5
                      text-[0.875rem] font-medium transition-colors duration-150
                      sm:inline-flex ${
                        awaiting
                          ? "bg-brand text-paper group-hover:bg-brandDark"
                          : "border border-rule text-ink group-hover:border-brand"
                      }`}
        >
          {awaiting ? "Review & approve" : "View"}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The drawing, small.
 *
 * A page about drawings that shows no drawings is a list of filenames. The
 * preview is generated at upload; when there is none (an odd PDF, a failed
 * render) the frame stays, so the row keeps its shape.
 */
function Thumbnail({ url }: { url: string | null }) {
  const frame =
    "flex h-[66px] w-[88px] shrink-0 items-center justify-center overflow-hidden border border-ruleSoft bg-sheet sm:h-[78px] sm:w-[104px]";

  if (!url) {
    return (
      <span aria-hidden className={frame}>
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-rule">
          <path
            d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M14 3v4h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={frame}>
      {/* contain, not cover: a plan is a drawing in the middle of a lot of
          white paper, and a centre crop of one is white paper. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
