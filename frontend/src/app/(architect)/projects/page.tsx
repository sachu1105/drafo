"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ProjectCard } from "@/components/architect/ProjectCard";
import { api } from "@/lib/api";
import type { Project, ProjectStatus } from "@/lib/types";

/**
 * The list, and the two ways of getting through it.
 *
 * A practice with three projects needs neither. A practice with sixty needs
 * both, and by then scrolling a grid of identical cards looking for a name is
 * the slowest thing in the product. They are shown from the first project
 * anyway: a control that only appears once the list is long enough is one
 * nobody knows about until it turns up, and by then they have learned to
 * scroll instead.
 *
 * Searching is the server's job, not this page's. Filtering an array that has
 * already been fetched only works while the whole list is in the browser,
 * which stops being true at exactly the size where search starts to matter --
 * and it could never do what Postgres does here anyway: rank the results, or
 * find "Kakkanad" when somebody types "Kakanad".
 */

const FILTERS: { value: "" | ProjectStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "active", label: "In progress" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<"" | ProjectStatus>("");
  /** How many there are in total, so a filtered count can say "of what". */
  const [total, setTotal] = useState<number | null>(null);

  // Every request gets a number and only the newest one is allowed to write
  // to state. Without this, typing quickly ends with whichever response the
  // network happened to return last on screen -- which is a list that matches
  // something the architect typed two keystrokes ago.
  const latest = useRef(0);

  useEffect(() => {
    const filtering = Boolean(term.trim() || status);
    const ticket = ++latest.current;

    // No wait on the first load or on a filter button: those are not typing.
    const wait = term.trim() ? 250 : 0;
    const timer = setTimeout(() => {
      const query = new URLSearchParams();
      if (term.trim()) query.set("q", term.trim());
      if (status) query.set("status", status);

      api<Project[]>(`/projects/${query.size ? `?${query}` : ""}`)
        .then((found) => {
          if (ticket !== latest.current) return;
          setProjects(found);
          if (!filtering) setTotal(found.length);
        })
        .catch(() => {
          if (ticket === latest.current) setFailed(true);
        });
    }, wait);

    return () => clearTimeout(timer);
  }, [term, status]);

  const filtering = Boolean(term.trim() || status);
  const waiting = (projects ?? []).reduce(
    (sum, project) => sum + project.awaiting_approval_count,
    0,
  );

  return (
    <main className="mx-auto max-w-shell px-4 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display">Projects</h1>
          {projects && projects.length > 0 ? (
            <p className="mt-1.5 text-[0.875rem] text-muted">
              {/* "3 of 12" while filtering, so the list never looks as though
                  nine projects have gone missing. */}
              {filtering && total !== null
                ? `${projects.length} of ${total}`
                : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
              {waiting > 0 ? (
                <>
                  <span className="text-faint"> · </span>
                  <span className="text-ink">{waiting} awaiting your client</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <Link href="/projects/new" className="btn-primary">
          New project
        </Link>
      </div>

      {/* Always here, not revealed once the list is long enough to need it.
          A control that appears on its own is one nobody knows exists until
          it turns up, and by then they have learned to scroll instead. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search projects</span>
          <Search
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Project or client"
            className="field pl-10 pr-10"
          />
          {term ? (
            <button
              type="button"
              onClick={() => setTerm("")}
              aria-label="Clear the search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2
                         items-center justify-center rounded-full text-faint
                         transition-colors duration-150 hover:text-ink"
            >
              <X aria-hidden size={14} strokeWidth={2} />
            </button>
          ) : null}
        </label>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const on = status === filter.value;
            return (
              <button
                key={filter.value || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setStatus(filter.value)}
                className={`rounded-full border px-3 py-1.5 text-[0.8125rem]
                            transition-colors duration-150 ${
                              on
                                ? "border-brand bg-brand text-paper"
                                : "border-rule text-muted hover:border-brand hover:text-ink"
                            }`}
              >
                {filter.label}
              </button>
            );
          })}
      </div>
      </div>

      <div className="mt-8">
        {failed ? (
          <p className="text-[0.9375rem] text-muted">
            Could not load your projects. Refresh the page to try again.
          </p>
        ) : projects === null ? (
          <Skeleton />
        ) : projects.length === 0 ? (
          /* "Nothing matched" and "you have no projects" are different
             sentences, and offering "create your first project" to somebody
             who has forty is absurd. */
          filtering ? (
            <NoMatches
              term={term}
              onClear={() => {
                setTerm("");
                setStatus("");
              }}
            />
          ) : (
            <Empty />
          )
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

function NoMatches({ term, onClear }: { term: string; onClear: () => void }) {
  return (
    <div className="border border-dashed border-rule bg-card px-6 py-14 text-center">
      <p className="font-display text-title">
        {term ? `Nothing matching “${term}”` : "Nothing with that status"}
      </p>
      <p className="mx-auto mt-2 max-w-reading text-[0.9375rem] leading-relaxed text-muted">
        Search looks at the project name and the client&rsquo;s name, and
        forgives a misspelling.
      </p>
      <button type="button" onClick={onClear} className="btn-quiet mt-6">
        Show everything
      </button>
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
