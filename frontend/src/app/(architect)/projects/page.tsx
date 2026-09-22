"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProjectCard } from "@/components/architect/ProjectCard";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<Project[]>("/projects/")
      .then(setProjects)
      .catch(() => setFailed(true));
  }, []);

  const waiting = (projects ?? []).reduce(
    (total, project) => total + project.awaiting_approval_count,
    0,
  );

  return (
    <main className="mx-auto max-w-shell px-4 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display">Projects</h1>
          {projects && projects.length > 0 ? (
            <p className="mt-1.5 text-[0.875rem] text-muted">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
              {waiting > 0 ? (
                <>
                  <span className="text-faint"> · </span>
                  <span className="text-ink">
                    {waiting} awaiting your client
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <Link href="/projects/new" className="btn-primary">
          New project
        </Link>
      </div>

      <div className="mt-9">
        {failed ? (
          <p className="text-[0.9375rem] text-muted">
            Could not load your projects. Refresh the page to try again.
          </p>
        ) : projects === null ? (
          <Skeleton />
        ) : projects.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/** Cards in outline, so the page does not jump when the data lands. */
function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-[168px] border border-ruleSoft bg-card/60" />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="border border-dashed border-rule bg-card px-6 py-14 text-center">
      <p className="font-display text-title">No projects yet</p>
      <p className="mx-auto mt-2 max-w-reading text-[0.9375rem] leading-relaxed text-muted">
        Create one for a real client, upload a drawing, and send them the link
        on WhatsApp. They will not need an account.
      </p>
      <Link href="/projects/new" className="btn-primary mt-6">
        Create your first project
      </Link>
    </div>
  );
}
