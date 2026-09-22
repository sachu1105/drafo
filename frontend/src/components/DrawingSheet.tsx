import { formatSize } from "@/lib/format";
import type { DrawingVersion } from "@/lib/types";

/**
 * The drawing itself.
 *
 * A PDF in an iframe is unreadable on a phone, so the server rasterises page
 * one at upload and we show that: one tap to open, legible without pinching.
 * The original file stays one tap further away for anyone who wants to print
 * it or hand it to a contractor.
 */
export function DrawingSheet({ version }: { version: DrawingVersion }) {
  return (
    <figure className="animate-rise">
      <a
        href={version.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block border border-rule bg-sheet"
      >
        {version.preview_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={version.preview_url}
            alt={`${version.file_name}, revision ${version.version_number}`}
            className="h-auto w-full"
          />
        ) : (
          <div className="flex min-h-[180px] items-center justify-center px-6 py-12 text-center">
            <p className="text-[0.9375rem] text-muted">
              Tap to open {version.file_name}
            </p>
          </div>
        )}
      </a>

      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <a
          href={version.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.875rem] text-ink underline decoration-rule
                     underline-offset-4 hover:decoration-ink"
        >
          Open full size
        </a>
        <span className="text-[0.8125rem] text-faint">
          {version.is_pdf ? "PDF" : "Image"}
          {" · "}
          {formatSize(version.file_size)}
        </span>
      </figcaption>
    </figure>
  );
}
