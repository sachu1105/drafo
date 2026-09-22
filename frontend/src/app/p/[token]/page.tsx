import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PracticeHeader } from "@/components/PracticeHeader";
import { DrawingRow } from "@/components/DrawingRow";
import { Empty, Section } from "@/components/Section";
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

          {awaiting > 0 ? (
            <p className="mt-6 border-l-2 border-ink pl-4 text-[0.9375rem] leading-relaxed">
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
              <div>
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

        <footer className="rule-top mt-16 pt-5 text-[0.8125rem] leading-relaxed text-faint">
          <p>
            This page is private to you and {project.practice.practice_name}. Anyone
            with the link can see it, so please keep it to yourself.
          </p>
          {project.practice.phone ? (
            <p className="mt-2">
              Questions?{" "}
              <a
                href={`tel:${project.practice.phone}`}
                className="text-muted underline decoration-rule"
              >
                {project.practice.phone}
              </a>
            </p>
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

  // Grouped so that a year of decisions is findable in one glance -- which is
  // the whole reason this section exists.
  const groups = new Map<string, Material[]>();
  for (const material of materials) {
    const list = groups.get(material.category_label) ?? [];
    list.push(material);
    groups.set(material.category_label, list);
  }

  return (
    <Section label="Materials" count={materials.length}>
      <div className="space-y-8 pt-2">
        {[...groups.entries()].map(([category, items]) => (
          <div key={category}>
            <h3 className="mb-1 text-[0.8125rem] font-medium text-muted">{category}</h3>
            <div>
              {items.map((material) => (
                <div
                  key={material.id}
                  className="flex items-start gap-4 border-b border-ruleSoft py-3.5"
                >
                  {material.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={material.photo_url}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] leading-snug">{material.name}</p>
                    {material.brand ? (
                      <p className="text-[0.8125rem] text-muted">{material.brand}</p>
                    ) : null}
                    {material.notes ? (
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-faint">
                        {material.notes}
                      </p>
                    ) : null}
                  </div>
                  {material.price ? (
                    <div className="shrink-0 text-right">
                      <p className="text-[0.9375rem] tabular-nums">
                        {formatMoney(material.price)}
                      </p>
                      {material.unit ? (
                        <p className="text-[0.75rem] text-faint">{material.unit}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
      <div className="pt-2">
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
                  "Due"
                )}
              </p>
            </div>
            <p className="shrink-0 tabular-nums">{formatMoney(milestone.amount)}</p>
          </div>
        ))}
        {outstanding > 0 ? (
          <div className="flex items-baseline gap-4 py-3.5">
            <p className="flex-1 text-[0.8125rem] text-muted">Outstanding</p>
            <p className="shrink-0 tabular-nums">{formatMoney(outstanding)}</p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
