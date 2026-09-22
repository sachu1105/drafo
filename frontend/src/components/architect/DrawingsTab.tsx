"use client";

import { useEffect, useState } from "react";
import { CommentThread } from "@/components/CommentThread";
import { Empty, FormActions, FormCard } from "@/components/architect/Form";
import { FileField } from "@/components/architect/FileField";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDateTime, formatSize } from "@/lib/format";
import type { DrawingSet, DrawingVersion } from "@/lib/types";
import { Tick } from "@/components/Tick";

export function DrawingsTab({
  projectId,
  clientName,
  onChanged,
  onShare,
}: {
  projectId: number;
  clientName: string;
  onChanged?: () => void;
  onShare?: () => void;
}) {
  const [sets, setSets] = useState<DrawingSet[] | null>(null);
  const [adding, setAdding] = useState(false);
  /** Which card is expanded. One at a time: a page of open accordions is
      noise, and only one of them is ever the thing being worked on. */
  const [openId, setOpenId] = useState<number | null>(null);

  async function load(): Promise<DrawingSet[]> {
    const loaded = await api<DrawingSet[]>(
      `/projects/${projectId}/drawing-sets/`,
    );
    setSets(loaded);
    return loaded;
  }

  useEffect(() => {
    load()
      .then((loaded) => {
        // Open the one that needs something doing, so the upload zone is on
        // screen instead of one click away behind a closed card.
        const empty = loaded.find((set) => !set.current_version);
        setOpenId(empty?.id ?? (loaded.length === 1 ? loaded[0].id : null));
      })
      .catch(() => setSets([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function refresh() {
    await load();
    onChanged?.();
  }

  const list = sets ?? [];
  const firstEmpty = list.find((set) => !set.current_version) ?? null;
  const awaiting = list.filter(
    (set) => set.current_version && !set.current_version.approval,
  );

  return (
    <div>
      <h2 className="sr-only">Drawings</h2>

      {/* A status line, not a banner.

          It used to be a bordered box with its own button, sitting directly
          above a card that said the same thing and already had the upload
          zone open inside it: three ways to start the same upload, stacked.
          The line below only appears when it says something the cards below
          do not, and it carries an action only when that action is somewhere
          else on the page. */}
      {sets !== null && list.length > 0 && !firstEmpty ? (
        awaiting.length > 0 ? (
          <p className="mb-5 text-[0.875rem] text-muted">
            Waiting on {clientName} to approve{" "}
            {awaiting.length === 1
              ? awaiting[0].title
              : `${awaiting.length} drawings`}
            .
          </p>
        ) : (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="text-[0.875rem] text-muted">
              Everything here is approved.
            </p>
            {onShare ? (
              <button type="button" onClick={onShare} className="btn-text px-0">
                Send {clientName} the link
              </button>
            ) : null}
          </div>
        )
      ) : null}

      {!adding && list.length > 0 ? (
        <div className="mb-5 flex justify-end">
          <button type="button" onClick={() => setAdding(true)} className="btn-quiet">
            Add drawing
          </button>
        </div>
      ) : null}

      {adding ? (
        <AddDrawingForm
          projectId={projectId}
          onDone={async (created) => {
            setAdding(false);
            await refresh();
            setOpenId(created.id); // straight into uploading to it
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      <div>
        {sets === null ? (
          <div className="space-y-3" aria-hidden>
            {[0, 1].map((key) => (
              <div key={key} className="h-[92px] border border-ruleSoft bg-card/60" />
            ))}
          </div>
        ) : list.length === 0 ? (
          !adding ? (
            <Empty
              title="No drawings yet"
              action="Add a drawing"
              onAction={() => setAdding(true)}
            />
          ) : null
        ) : (
          <div className="space-y-3">
            {list.map((set) => (
              <DrawingSetCard
                key={set.id}
                set={set}
                open={openId === set.id}
                onToggle={() =>
                  setOpenId((current) => (current === set.id ? null : set.id))
                }
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddDrawingForm({
  projectId,
  onDone,
  onCancel,
}: {
  projectId: number;
  onDone: (created: DrawingSet) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const created = await api<DrawingSet>(
        `/projects/${projectId}/drawing-sets/`,
        { method: "POST", body: { title: title.trim() } },
      );
      setTitle("");
      onDone(created);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3">
      <FormCard onSubmit={submit}>
        <label htmlFor="new-drawing" className="eyebrow block">
          Drawing name
        </label>
        <input
          id="new-drawing"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ground Floor Plan"
          autoFocus
          className="field mt-2 sm:max-w-md"
        />
        <FormActions
          submitLabel="Add drawing"
          busyLabel="Adding…"
          busy={busy}
          disabled={!title.trim()}
          onCancel={onCancel}
        />
      </FormCard>
    </div>
  );
}

function DrawingSetCard({
  set,
  open,
  onToggle,
  onChanged,
}: {
  set: DrawingSet;
  open: boolean;
  onToggle: () => void;
  onChanged: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<DrawingVersion[] | null>(null);
  const current = set.current_version;

  async function loadVersions() {
    setVersions(await api<DrawingVersion[]>(`/drawing-sets/${set.id}/versions/`));
  }

  useEffect(() => {
    if (open && versions === null) loadVersions().catch(() => setVersions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <article className={`border bg-card ${open ? "border-brand" : "border-rule"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left
                   transition-colors duration-150 hover:bg-paper/60"
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[1.375rem] leading-snug">
            {set.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
            {current ? (
              <>
                <span className="text-muted">
                  Revision {current.version_number}
                </span>
                <Dot />
                <span className="text-muted">
                  {formatDate(current.uploaded_at)}
                </span>
                <Dot />
                {current.approval ? (
                  <span className="flex items-center gap-1.5 text-accent">
                    <Tick />
                    Approved by {current.approval.approved_by_name}
                  </span>
                ) : (
                  <span className="font-medium text-ink">Awaiting approval</span>
                )}
              </>
            ) : (
              <span className="text-faint">Nothing uploaded yet</span>
            )}
          </p>
        </div>

        {set.version_count > 0 ? (
          <span className="hidden shrink-0 text-[0.8125rem] tabular-nums text-faint sm:block">
            {set.version_count}{" "}
            {set.version_count === 1 ? "revision" : "revisions"}
          </span>
        ) : null}
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="animate-rise border-t border-ruleSoft">
          <UploadPanel
            setId={set.id}
            isFirst={!current}
            onUploaded={async () => {
              await loadVersions();
              await onChanged();
            }}
          />

          {set.version_count > 0 ? (
            <div className="border-t border-ruleSoft px-5 py-5">
              <h4 className="eyebrow">Revision history</h4>
              {versions === null ? (
                <p className="mt-3 text-[0.875rem] text-faint">Loading…</p>
              ) : (
                <ol className="mt-3 space-y-px bg-rule">
                  {versions.map((version) => (
                    <RevisionRow
                      key={version.id}
                      version={version}
                      isCurrent={version.version_number === current?.version_number}
                    />
                  ))}
                </ol>
              )}
            </div>
          ) : null}

          {current ? (
            /* No rule of its own: the wrapper already draws one, and the two
               together were a hairline and then a second, inset hairline. */
            <div className="border-t border-ruleSoft px-5 py-5">
              <CommentThread
                mode="architect"
                versionId={current.id}
                initial={
                  versions?.find((version) => version.id === current.id)?.comments ?? []
                }
                onPosted={loadVersions}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function UploadPanel({
  setId,
  isFirst,
  onUploaded,
}: {
  setId: number;
  isFirst: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    const payload = new FormData();
    payload.append("file", file);
    if (notes.trim()) payload.append("notes", notes.trim());

    setBusy(true);
    setError(null);
    try {
      await api<DrawingVersion>(`/drawing-sets/${setId}/versions/`, {
        method: "POST",
        body: payload,
      });
      setFile(null);
      setNotes("");
      await onUploaded();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="px-5 py-5">
      <h4 className="eyebrow">
        {isFirst ? "Upload the drawing" : "Upload a new revision"}
      </h4>

      <div className="mt-3">
        <FileField
          file={file}
          onFile={setFile}
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          hint="PDF, PNG or JPG · up to 25 MB"
          disabled={busy}
        />
      </div>

      {/* Only worth asking once there is something to have changed from. */}
      {!isFirst ? (
        <input
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What changed? e.g. moved the kitchen window 300mm"
          className="field mt-3"
        />
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[0.875rem]">
          {error}
        </p>
      ) : null}

      {/* The note about the client being emailed used to live beside this
          button. It is true of every upload in the product and it was being
          restated on every card, every time. */}
      <div className="mt-4">
        <button type="submit" disabled={busy || !file} className="btn-primary">
          {busy ? "Uploading…" : isFirst ? "Upload drawing" : "Upload revision"}
        </button>
      </div>
    </form>
  );
}

function RevisionRow({
  version,
  isCurrent,
}: {
  version: DrawingVersion;
  isCurrent: boolean;
}) {
  return (
    <li className="bg-card px-4 py-3.5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center
                      text-[0.75rem] tabular-nums ${
                        isCurrent
                          ? "bg-brand text-paper"
                          : "border border-rule text-muted"
                      }`}
        >
          {version.version_number}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-[0.9375rem]">Revision {version.version_number}</p>
            {isCurrent ? (
              <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-faint">
                Current
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-muted">
            <span className="truncate">{version.file_name}</span>
            <Dot />
            <span>{formatSize(version.file_size)}</span>
            <Dot />
            <span>{formatDate(version.uploaded_at)}</span>
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
          ) : (
            <p className="mt-1.5 text-[0.8125rem] text-faint">Not approved</p>
          )}
        </div>

        <a
          href={version.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[0.8125rem] text-muted underline
                     decoration-rule underline-offset-4 hover:text-ink"
        >
          Open
        </a>
      </div>
    </li>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-faint">
      ·
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-150 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M2.5 4.5L6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
