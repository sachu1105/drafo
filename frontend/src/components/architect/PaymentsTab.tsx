"use client";

import { useEffect, useState } from "react";
import {
  Empty,
  FormActions,
  FormCard,
  FormGrid,
  Labelled,
  MoneyInput,
} from "@/components/architect/Form";
import { InvoicesPanel } from "@/components/architect/InvoicesPanel";
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
      {!adding && list.length > 0 ? (
        <div className="mb-5 flex justify-end">
          <button type="button" onClick={() => setAdding(true)} className="btn-quiet">
            Add milestone
          </button>
        </div>
      ) : null}

      {adding ? (
        <div className="mb-6">
          <AddMilestoneForm
            projectId={projectId}
            onDone={async () => {
              setAdding(false);
              await refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : null}

      {list.length > 0 ? (
        <dl className="grid gap-px border border-rule bg-rule sm:grid-cols-3">
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
            <Empty
              title="No milestones yet"
              action="Add a milestone"
              onAction={() => setAdding(true)}
            />
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

      {/* Billing sits under the stages, not in a tab of its own: "what have I
          billed" and "what am I owed" are the same question, and splitting
          them puts half the answer one click away. */}
      <InvoicesPanel projectId={projectId} milestones={list} />
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
    <FormCard onSubmit={submit}>
      <FormGrid>
        <Labelled label="Stage" span={8}>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Concept design approval"
            autoFocus
            className="field"
          />
        </Labelled>

        <Labelled label="Amount" span={4}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Labelled>
      </FormGrid>

      <FormActions
        submitLabel="Add milestone"
        busyLabel="Saving…"
        busy={busy}
        disabled={!title.trim() || !amount.trim()}
        onCancel={onCancel}
      />
    </FormCard>
  );
}
