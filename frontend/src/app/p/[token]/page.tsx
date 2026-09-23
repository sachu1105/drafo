import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PracticeHeader } from "@/components/PracticeHeader";
import { DrawingRow } from "@/components/DrawingRow";
import { Empty, Section } from "@/components/Section";
import { MaterialList } from "@/components/MaterialList";
import { fetchClientData } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { ClientProject, Material, Milestone } from "@/lib/types";
import { Tick } from "@/components/Tick";

/**
 * The client overview. The screen the whole business rests on.
 *
 * Rendered on the server so it arrives complete on a phone on 3G, with no
 * spinner and no second round trip. No account, no login, no app to install:
 * the token in the URL is the entire way in.
 */

export const dynamic = "force-dynamic";

/**
 * The tab says the project name, not ours. As far as the client is concerned
 * this page belongs to their architect.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const project = await fetchClientData<ClientProject>(`/api/p/${token}/`);
  if (!project) return { title: "Link not available" };
  return {
    title: `${project.name} · ${project.practice.practice_name}`,
  };
}

export default async function ClientPortal({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = await fetchClientData<ClientProject>(`/api/p/${token}/`);
  if (!project) notFound();

  const awaiting = project.drawing_sets.filter(
    (set) => set.current_version && !set.current_version.approval,
  ).length;

  return (
    <div className="min-h-screen">
      <PracticeHeader practice={project.practice} />

      <main className="mx-auto max-w-sheet px-4 pb-20 pt-9 sm:px-8 sm:pt-14">
        <div className="animate-rise">
          <h1 className="font-display text-display">{project.name}</h1>
          <p className="mt-2 text-[0.9375rem] text-muted">
            For {project.client_name}
            {project.address ? (
              <>
                <span className="text-faint"> · </span>
                {project.address.split("\n")[0]}
              </>
            ) : null}
          </p>

          {/* A notice, not a pull-quote. The bare left-ruled line this used
              to be reads as a stray sentence; the one thing the page is
              asking for should look like it is asking. */}
          {awaiting > 0 ? (
            <p className="mt-6 flex items-center gap-3 bg-sand px-4 py-3 text-[0.9375rem]">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-ink" />
              {awaiting === 1
                ? "One drawing is waiting for your approval."
                : `${awaiting} drawings are waiting for your approval.`}
            </p>
          ) : null}
        </div>

        <div className="mt-12 space-y-12">
          <Section label="Drawings">
            {project.drawing_sets.length === 0 ? (
              <Empty>Nothing has been shared yet.</Empty>
            ) : (
              <div className="space-y-3">
                {project.drawing_sets.map((set) => (
                  <DrawingRow
                    key={set.id}
                    set={set}
                    href={`/p/${token}/drawings/${set.id}`}
                  />
                ))}
              </div>
            )}
          </Section>

          <Materials materials={project.materials} />
          <Payments milestones={project.milestones} />
        </div>

        <footer className="rule-top mt-16 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-5">
          <p className="text-[0.8125rem] leading-relaxed text-faint">
            Private to you and {project.practice.practice_name} — please keep the
            link to yourself.
          </p>
          {project.practice.phone ? (
            <a
              href={`tel:${project.practice.phone}`}
              className="btn-quiet shrink-0 px-5 py-2.5"
            >
              Call {project.practice.practice_name}
            </a>
          ) : null}
        </footer>
      </main>
    </div>
  );
}

function Materials({ materials }: { materials: Material[] }) {
  if (materials.length === 0) {
    return (
      <Section label="Materials">
        <Empty>No selections recorded yet.</Empty>
      </Section>
    );
  }

  return (
    <Section label="Materials" count={materials.length}>
      <MaterialList materials={materials} />
    </Section>
  );
}

function Payments({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <Section label="Payments">
        <Empty>No payment schedule recorded yet.</Empty>
      </Section>
    );
  }

  const outstanding = milestones
    .filter((milestone) => !milestone.is_paid)
    .reduce((total, milestone) => total + Number(milestone.amount), 0);

  return (
    <Section label="Payments">
      <div>
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            className="flex items-baseline gap-4 border-b border-ruleSoft py-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] leading-snug">{milestone.title}</p>
              <p className="mt-0.5 text-[0.8125rem] text-muted">
                {milestone.is_paid ? (
                  <span className="inline-flex items-center gap-1.5 text-accent">
                    <Tick />
                    Paid{milestone.paid_on ? ` ${formatDate(milestone.paid_on)}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full border border-muted"
                    />
                    Due
                  </span>
                )}
              </p>
            </div>
            <p className="shrink-0 tabular-nums">{formatMoney(milestone.amount)}</p>
          </div>
        ))}
        {/* Set apart and set heavier, because in a column of identically
            weighted rows a total reads as one more thing that is owed. */}
        {outstanding > 0 ? (
          <div className="mt-1 flex items-baseline gap-4 border-t-2 border-ink pt-3.5">
            <p className="flex-1 text-[0.9375rem] font-medium">Outstanding</p>
            <p className="shrink-0 text-[1.125rem] font-medium tabular-nums">
              {formatMoney(outstanding)}
            </p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
