"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Milestone } from "@/lib/types";
import { Tick } from "@/components/Tick";

/**
 * Milestones are a record, not a checkout.
 *
 * No gateway, no fees, no reconciliation: money moves over UPI as it already
 * does. What was missing was a place where "concept design is approved, this
 * stage is payable" is written down, so asking for it stops being awkward.
 */
export function PaymentsTab({
  projectId,
  onChanged,
}: {
  projectId: number;
  onChanged?: () => void;
}) {
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setMilestones(await api<Milestone[]>(`/projects/${projectId}/milestones/`));
  }

  useEffect(() => {
    load().catch(() => setMilestones([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function refresh() {
    await load();
    onChanged?.();
  }

  async function togglePaid(milestone: Milestone) {
    await api<Milestone>(`/milestones/${milestone.id}/`, {
      method: "PATCH",
      body: milestone.is_paid
        ? { is_paid: false, paid_on: null }
        : { is_paid: true, paid_on: new Date().toISOString().slice(0, 10) },
    });
    await refresh();
  }

  const list = milestones ?? [];
  const total = list.reduce((sum, item) => sum + Number(item.amount), 0);
  const received = list
    .filter((item) => item.is_paid)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const outstanding = total - received;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-title">Payments</h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            A record of what is due and what has been paid. Money moves
            elsewhere.
          </p>
        </div>
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn-quiet">
            Add milestone
          </button>
        ) : null}
      </div>

      {adding ? (
        <AddMilestoneForm
          projectId={projectId}
          onDone={async () => {
            setAdding(false);
            await refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {list.length > 0 ? (
        <dl className="mt-6 grid gap-px border border-rule bg-rule sm:grid-cols-3">
          <Figure label="Total" value={formatMoney(total)} />
          <Figure label="Received" value={formatMoney(received)} tone="accent" />
          <Figure label="Outstanding" value={formatMoney(outstanding)} tone="ink" />
        </dl>
      ) : null}

      <div className="mt-6">
        {milestones === null ? (
          <p className="text-[0.875rem] text-faint">Loading…</p>
        ) : list.length === 0 ? (
          !adding ? (
            <div className="border border-dashed border-rule bg-card px-6 py-12 text-center">
              <p className="font-display text-[1.25rem]">No milestones yet</p>
              <p className="mx-auto mt-2 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted">
                Write the stages down — “Concept design approval”, “Working
                drawings issued” — so asking for payment is never a
                conversation you have to start from nothing.
              </p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="btn-primary mt-6"
              >
                Add the first milestone
              </button>
            </div>
          ) : null
        ) : (
          <ul className="space-y-px bg-rule">
            {list.map((milestone) => (
              <li
                key={milestone.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-4 py-4"
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    milestone.is_paid ? "bg-accent" : "bg-rule"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem]">{milestone.title}</p>
                  <p className="mt-0.5 text-[0.8125rem]">
                    {milestone.is_paid ? (
                      <span className="flex items-center gap-1.5 text-accent">
                        <Tick />
                        Paid
                        {milestone.paid_on ? ` ${formatDate(milestone.paid_on)}` : ""}
                      </span>
                    ) : (
                      <span className="text-muted">Unpaid</span>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-[1.0625rem] tabular-nums">
                  {formatMoney(milestone.amount)}
                </p>
                <button
                  type="button"
                  onClick={() => togglePaid(milestone)}
                  className="shrink-0 whitespace-nowrap border border-rule px-3 py-1.5
                             text-[0.8125rem] text-muted transition-colors duration-150
                             hover:border-brand hover:text-ink"
                >
                  {milestone.is_paid ? "Mark unpaid" : "Mark paid"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "ink";
}) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={`mt-1.5 text-[1.375rem] tabular-nums ${
          tone === "accent" ? "text-accent" : tone === "ink" ? "text-ink" : "text-muted"
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function AddMilestoneForm({
  projectId,
  onDone,
  onCancel,
}: {
  projectId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !amount.trim()) return;
    setBusy(true);
    try {
      await api<Milestone>(`/projects/${projectId}/milestones/`, {
        method: "POST",
        body: { title: title.trim(), amount: amount.trim() },
      });
      setTitle("");
      setAmount("");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 animate-rise border border-rule bg-card p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <label className="block">
          <span className="eyebrow block">Stage</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Concept design approval"
            autoFocus
            className="field mt-2"
          />
        </label>
        <label className="block">
          <span className="eyebrow block">Amount</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="field mt-2"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-ruleSoft pt-4">
        <button
          type="submit"
          disabled={busy || !title.trim() || !amount.trim()}
          className="btn-primary"
        >
          {busy ? "Saving…" : "Add milestone"}
        </button>
        <button type="button" onClick={onCancel} className="btn-quiet">
          Cancel
        </button>
      </div>
    </form>
  );
}
