import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/types";

/**
 * One project.
 *
 * The card answers the only question the architect opens this page to ask:
 * is anything waiting on me? That marker gets the weight; everything else is
 * reference.
 */
export function ProjectCard({ project }: { project: Project }) {
  const waiting = project.awaiting_approval_count;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="card-link group flex flex-col border border-rule bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[1.3125rem] leading-snug">{project.name}</h2>
        {project.status !== "active" ? (
          <span className="chip mt-0.5 border border-rule text-muted">
            {project.status_label}
          </span>
        ) : null}
      </div>

      <p className="mt-1 truncate text-[0.875rem] text-muted">{project.client_name}</p>

      {waiting > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-[0.875rem] font-medium text-ink">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />
          {waiting === 1 ? "1 drawing awaiting approval" : `${waiting} drawings awaiting approval`}
        </p>
      ) : project.drawing_set_count > 0 ? (
        <p className="mt-4 text-[0.875rem] text-accent">Nothing awaiting approval</p>
      ) : (
        <p className="mt-4 text-[0.875rem] text-faint">No drawings yet</p>
      )}

      <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-ruleSoft pt-3">
        <span className="text-[0.8125rem] text-muted">
          {project.drawing_set_count}{" "}
          {project.drawing_set_count === 1 ? "drawing" : "drawings"}
        </span>
        <span className="text-[0.8125rem] text-faint">
          {formatDate(project.updated_at)}
        </span>
      </div>
    </Link>
  );
}
