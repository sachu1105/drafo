"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { DrawingsTab } from "@/components/architect/DrawingsTab";
import { MaterialsTab } from "@/components/architect/MaterialsTab";
import { PaymentsTab } from "@/components/architect/PaymentsTab";
import { ShareTab } from "@/components/architect/ShareTab";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

const TABS = ["Drawings", "Materials", "Payments", "Share"] as const;
type Tab = (typeof TABS)[number];

function Dot() {
  return (
    <span aria-hidden className="text-faint">
      ·
    </span>
  );
}

const STATUS_LABEL: Record<Project["status"], string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("Drawings");

  const reload = useCallback(() => {
    api<Project>(`/projects/${projectId}/`)
      .then(setProject)
      .catch(() => setMissing(true));
  }, [projectId]);

  useEffect(reload, [reload]);

  if (missing) {
    return (
      <main className="mx-auto max-w-shell px-4 py-10 sm:px-8">
        <p className="text-[0.9375rem] text-muted">
          That project does not exist.{" "}
          <Link href="/projects" className="underline decoration-rule">
            Back to projects
          </Link>
        </p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="mx-auto max-w-shell px-4 py-10 text-[0.875rem] text-faint sm:px-8">
        Loading…
      </main>
    );
  }

  const counts: Record<Tab, number> = {
    Drawings: project.drawing_set_count,
    Materials: project.material_count,
    Payments: project.milestone_count,
    Share: 0,
  };

  return (
    <main className="mx-auto max-w-shell px-4 pb-20 pt-8 sm:px-8">
      <Link
        href="/projects"
        className="inline-flex min-h-[32px] items-center text-[0.875rem]
                   text-muted hover:text-ink"
      >
        &lsaquo;&nbsp; Projects
      </Link>

      {/* --- header ------------------------------------------------------ */}
      <header className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-display">{project.name}</h1>
            {project.status !== "active" ? (
              <span className="border border-rule px-2 py-0.5 text-[0.75rem] text-muted">
                {STATUS_LABEL[project.status]}
              </span>
            ) : null}
          </div>

          {/* One line, middot-separated -- the same rhythm as every other
              meta line in the app. The mix of a "Client" label with two
              unlabelled values read as three unrelated fragments. */}
          <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.875rem]">
            <span>{project.client_name}</span>
            {project.client_phone ? (
              <>
                <Dot />
                <a
                  href={`tel:${project.client_phone}`}
                  className="text-muted hover:text-ink"
                >
                  {project.client_phone}
                </a>
              </>
            ) : null}
            {project.client_email ? (
              <>
                <Dot />
                <a
                  href={`mailto:${project.client_email}`}
                  className="truncate text-muted hover:text-ink"
                >
                  {project.client_email}
                </a>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {project.awaiting_approval_count > 0 ? (
            <span className="flex items-center gap-2 border border-rule bg-card px-3 py-2 text-[0.8125rem]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />
              {project.awaiting_approval_count} awaiting approval
            </span>
          ) : null}
          {/* A shortcut to the Share tab. Offered everywhere except on the
              Share tab, where it is a button that goes where you already
              are. */}
          {tab !== "Share" ? (
            <button
              type="button"
              onClick={() => setTab("Share")}
              className="btn-quiet px-4 py-2"
            >
              Share with client
            </button>
          ) : null}
        </div>
      </header>

      {/* --- tabs -------------------------------------------------------- */}
      <nav className="mt-8 flex gap-7 overflow-x-auto border-b border-rule">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            aria-current={tab === name ? "page" : undefined}
            className={`-mb-px flex min-h-[44px] shrink-0 items-center gap-1.5
                        border-b-2 text-[0.9375rem] transition-colors duration-150 ${
                          tab === name
                            ? "border-brand text-ink"
                            : "border-transparent text-muted hover:text-ink"
                        }`}
          >
            {name}
            {counts[name] > 0 ? (
              <span className="text-[0.75rem] tabular-nums text-faint">
                {counts[name]}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="pt-9">
        {tab === "Drawings" ? (
          <DrawingsTab
            projectId={projectId}
            clientName={project.client_name}
            onChanged={reload}
            onShare={() => setTab("Share")}
          />
        ) : tab === "Materials" ? (
          <MaterialsTab projectId={projectId} onChanged={reload} />
        ) : tab === "Payments" ? (
          <PaymentsTab projectId={projectId} onChanged={reload} />
        ) : (
          <ShareTab project={project} onChange={setProject} />
        )}
      </div>
    </main>
  );
}
