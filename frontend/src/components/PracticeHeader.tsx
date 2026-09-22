import Link from "next/link";
import type { Practice } from "@/lib/types";

/**
 * The letterhead.
 *
 * This should read as the architect's own stationery, not as a product someone
 * sold them. No logo of ours appears anywhere on the client's screen.
 */
export function PracticeHeader({
  practice,
  href,
}: {
  practice: Practice;
  href?: string;
}) {
  const mark = practice.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={practice.logo_url}
      alt={practice.practice_name}
      className="max-h-10 w-auto max-w-[200px] object-contain object-left"
    />
  ) : (
    <span className="font-display text-[1.375rem] leading-none tracking-tight">
      {practice.practice_name}
    </span>
  );

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-sheet items-center px-4 py-5 sm:px-8">
        {href ? (
          <Link href={href} className="min-h-[44px] flex items-center">
            {mark}
          </Link>
        ) : (
          mark
        )}
      </div>
    </header>
  );
}
