import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { DrawingSet } from "@/lib/types";
import { Tick } from "@/components/Tick";

/**
 * One drawing in the client's list.
 *
 * Three facts, in the order they are wanted: what it is, how current it is,
 * and whether anything is being asked of them.
 */
export function DrawingRow({ set, href }: { set: DrawingSet; href: string }) {
  const version = set.current_version;
  const approval = version?.approval ?? null;

  return (
    <Link
      href={href}
      className="group -mx-2 flex items-center gap-4 border-b border-ruleSoft px-2 py-4
                 transition-colors duration-150 hover:bg-card"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[1.25rem] leading-snug">{set.title}</p>

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

        {version ? (
          approval ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] text-accent">
              <Tick />
              Approved {formatDate(approval.approved_at)}
            </p>
          ) : (
            <p className="mt-1.5 flex items-center gap-2 text-[0.8125rem] font-medium text-ink">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />
              Awaiting your approval
            </p>
          )
        ) : null}
      </div>

      <span
        aria-hidden
        className="shrink-0 text-faint transition-transform duration-150
                   group-hover:translate-x-0.5"
      >
        &rsaquo;
      </span>
    </Link>
  );
}
