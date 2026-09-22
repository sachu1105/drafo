import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprovePanel } from "@/components/ApprovePanel";
import { CommentThread } from "@/components/CommentThread";
import { DrawingSheet } from "@/components/DrawingSheet";
import { fetchClientData } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DrawingSet, DrawingVersion } from "@/lib/types";
import { Tick } from "@/components/Tick";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string; setId: string }>;
}): Promise<Metadata> {
  const { token, setId } = await params;
  const set = await fetchClientData<DrawingSet>(
    `/api/p/${token}/drawing-sets/${setId}/`,
  );
  return { title: set ? set.title : "Link not available" };
}

export default async function DrawingDetail({
  params,
}: {
  params: Promise<{ token: string; setId: string }>;
}) {
  const { token, setId } = await params;
  const set = await fetchClientData<DrawingSet>(
    `/api/p/${token}/drawing-sets/${setId}/`,
  );
  if (!set) notFound();

  // The API orders versions newest first.
  const versions = set.versions ?? [];
  const current = versions[0] ?? null;
  const previous = versions.slice(1);

  return (
    <div className="min-h-screen">
      <div className="border-b border-rule">
        <div className="mx-auto max-w-sheet px-4 sm:px-8">
          <Link
            href={`/p/${token}`}
            className="-ml-1 inline-flex min-h-[44px] items-center gap-2 pr-3
                       text-[0.875rem] text-muted hover:text-ink"
          >
            <span aria-hidden>&lsaquo;</span> All drawings
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-sheet px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
        <h1 className="font-display text-display">{set.title}</h1>

        {current ? (
          <>
            <p className="mt-2 text-[0.9375rem] text-muted">
              Revision {current.version_number}
              <span className="text-faint"> · </span>
              {formatDate(current.uploaded_at)}
              {previous.length > 0 ? (
                <span className="text-faint"> · current</span>
              ) : null}
            </p>

            {current.notes ? (
              <p className="mt-5 border-l-2 border-rule pl-4 text-[0.9375rem] leading-relaxed">
                {current.notes}
              </p>
            ) : null}

            <div className="mt-7">
              <DrawingSheet version={current} />
            </div>

            <ApprovePanel
              token={token}
              versionId={current.id}
              approval={current.approval}
              revision={current.version_number}
            />

            <CommentThread
              mode="client"
              token={token}
              versionId={current.id}
              initial={current.comments ?? []}
            />

            {previous.length > 0 ? (
              <PreviousRevisions versions={previous} />
            ) : null}
          </>
        ) : (
          <p className="mt-6 text-[0.9375rem] text-muted">
            Nothing has been uploaded for this drawing yet.
          </p>
        )}
      </main>
    </div>
  );
}

/**
 * Superseded revisions, collapsed. They matter -- an approval on revision 1
 * stays attached to revision 1 forever -- but they must never compete with the
 * current drawing for attention.
 */
function PreviousRevisions({ versions }: { versions: DrawingVersion[] }) {
  return (
    <details className="rule-top group mt-10 pt-5">
      <summary
        className="flex min-h-[44px] cursor-pointer list-none items-center
                   text-[0.9375rem] text-muted marker:hidden hover:text-ink"
      >
        <span
          aria-hidden
          className="mr-2 inline-block transition-transform duration-150
                     group-open:rotate-90"
        >
          &rsaquo;
        </span>
        Previous revisions ({versions.length})
      </summary>

      <div className="mt-2">
        {versions.map((version) => (
          <div key={version.id} className="border-b border-ruleSoft py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p className="text-[0.9375rem]">Revision {version.version_number}</p>
              <a
                href={version.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.875rem] text-muted underline decoration-rule
                           underline-offset-4 hover:text-ink"
              >
                Open
              </a>
            </div>
            <p className="mt-0.5 text-[0.8125rem] text-muted">
              {formatDate(version.uploaded_at)}
            </p>
            {version.notes ? (
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                {version.notes}
              </p>
            ) : null}
            {version.approval ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] text-accent">
                <Tick />
                Approved by {version.approval.approved_by_name} on{" "}
                {formatDateTime(version.approval.approved_at)}
              </p>
            ) : null}
            {/* What was said at the time stays with the revision it was said
                about -- that is half the point of keeping old revisions. */}
            {version.comments && version.comments.length > 0 ? (
              <ol className="mt-2 space-y-2 border-l border-rule pl-3">
                {version.comments.map((comment) => (
                  <li key={comment.id}>
                    <p className="text-[0.75rem] text-faint">
                      {comment.author_name}
                      <span> · </span>
                      {formatDate(comment.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-muted">
                      {comment.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}
