"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormActions, FormCard, Labelled } from "@/components/architect/Form";
import { Select } from "@/components/architect/Select";
import { choicesFor } from "@/components/architect/TaxRateField";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type {
  Invoice,
  InvoiceKind,
  InvoiceLine,
  Material,
  Milestone,
  TaxRate,
} from "@/lib/types";

/**
 * Building a bill.
 *
 * The screen is a table of lines and nothing else clever. Everything about
 * this form is in service of one thing: the figures on the document have to
 * be the architect's, and they have to be checkable at a glance before it
 * goes out.
 *
 * Lines are *copied* from milestones and materials, never linked to them. A
 * stage agreed at 20,000 that is being billed at 18,000 this month is an
 * ordinary thing to do, and a builder that wrote the 18,000 back into the
 * project would quietly corrupt the plan the client agreed to. The link is
 * kept only so the list can say a stage has been billed already.
 *
 * Tax is per line, not per invoice. A design fee at 18% and a reimbursed
 * printing charge at nil go on the same bill all the time, and an invoice
 * that can only carry one rate forces them onto two.
 */

const BLANK_LINE: InvoiceLine = {
  description: "",
  quantity: "1",
  unit: "",
  rate: "",
  tax_percent: "0",
};

export function InvoiceBuilder({
  projectId,
  kind,
  invoice,
  milestones,
  materials,
  defaultTaxPercent,
  onDone,
  onCancel,
}: {
  projectId: number;
  /** Which series this belongs to. Fixed once it exists. */
  kind: InvoiceKind;
  /** Present when editing one that already exists. */
  invoice?: Invoice;
  milestones: Milestone[];
  materials: Material[];
  defaultTaxPercent: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = invoice !== undefined;
  const [lines, setLines] = useState<InvoiceLine[]>(
    () => invoice?.lines.map((line) => ({ ...line })) ?? [],
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [dueOn, setDueOn] = useState(invoice?.due_on ?? "");
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A failure here costs the dropdown, not the invoice: the rate is a
    // number on the line either way.
    api<TaxRate[]>("/tax-rates/")
      .then(setRates)
      .catch(() => setRates([]));
  }, []);

  /** What is already on the invoice, so the pickers can say so. */
  const taken = useMemo(
    () => ({
      milestones: new Set(lines.map((line) => line.milestone).filter(Boolean)),
      materials: new Set(lines.map((line) => line.material).filter(Boolean)),
    }),
    [lines],
  );

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const line of lines) {
      const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
      subtotal += amount;
      tax += (amount * (Number(line.tax_percent) || 0)) / 100;
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  function add(line: Partial<InvoiceLine>) {
    setLines((current) => [
      ...current,
      { ...BLANK_LINE, tax_percent: defaultTaxPercent, ...line },
    ]);
  }

  function set(index: number, patch: Partial<InvoiceLine>) {
    setLines((current) =>
      current.map((line, at) => (at === index ? { ...line, ...patch } : line)),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const usable = lines.filter((line) => line.description.trim());
    if (usable.length === 0) {
      setError("Add at least one line before saving.");
      return;
    }

    const payload = {
      kind,
      due_on: dueOn || null,
      notes,
      lines: usable.map((line, order) => ({
        description: line.description.trim(),
        quantity: line.quantity || "1",
        unit: line.unit,
        rate: line.rate || "0",
        tax_percent: line.tax_percent || "0",
        order,
        milestone: line.milestone ?? null,
        material: line.material ?? null,
      })),
    };

    setBusy(true);
    setError(null);
    try {
      await api<Invoice>(
        editing ? `/invoices/${invoice.id}/` : `/projects/${projectId}/invoices/`,
        { method: editing ? "PATCH" : "POST", body: payload },
      );
      onDone();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not save that.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormCard onSubmit={submit}>
      <div className="space-y-6">
        {/* --- what to bill for ------------------------------------------
            Offered before the table rather than beside it: the common case
            is billing a stage that already exists, and making the architect
            retype its title and figure is the thing this whole panel is for. */}
        <Pickers
          milestones={milestones}
          materials={materials}
          taken={taken}
          onPick={add}
          onBlank={() => add({})}
        />

        {lines.length === 0 ? (
          <p className="border border-dashed border-rule bg-paper px-4 py-8 text-center text-[0.875rem] text-faint">
            Nothing on this {kind === "estimate" ? "estimate" : "invoice"} yet.
          </p>
        ) : (
          <LineTable
            lines={lines}
            rates={rates}
            onChange={set}
            onRemove={(index) =>
              setLines((current) => current.filter((_, at) => at !== index))
            }
          />
        )}

        <Totals {...totals} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Labelled label="Due by" span={12}>
            <input
              type="date"
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
              className="field"
            />
          </Labelled>

          <Labelled label="Note on the invoice" span={12}>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the client should read with it"
              className="field"
            />
          </Labelled>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-[0.875rem] text-ink">
          {error}
        </p>
      ) : null}

      <FormActions
        submitLabel={editing ? "Save changes" : `Create ${kind}`}
        busyLabel="Saving…"
        busy={busy}
        disabled={lines.length === 0}
        onCancel={onCancel}
      />
    </FormCard>
  );
}

/**
 * What can be billed for, as things to press.
 *
 * A stage already on the invoice is shown struck through rather than removed.
 * A list that silently shortens as it is used gives the architect no way to
 * tell "I have billed that" from "that was never here".
 */
function Pickers({
  milestones,
  materials,
  taken,
  onPick,
  onBlank,
}: {
  milestones: Milestone[];
  materials: Material[];
  taken: { milestones: Set<unknown>; materials: Set<unknown> };
  onPick: (line: Partial<InvoiceLine>) => void;
  onBlank: () => void;
}) {
  const billable = materials.filter((material) => material.price);

  return (
    <div className="space-y-3 border border-ruleSoft bg-paper p-4">
      <p className="eyebrow">Add from this project</p>

      {milestones.length === 0 && billable.length === 0 ? (
        <p className="text-[0.8125rem] text-faint">
          No payment stages or priced materials on this project yet.
        </p>
      ) : null}

      {milestones.length > 0 ? (
        <Row label="Stages">
          {milestones.map((milestone) => (
            <Chip
              key={`m${milestone.id}`}
              used={taken.milestones.has(milestone.id)}
              onClick={() =>
                onPick({
                  description: milestone.title,
                  quantity: "1",
                  rate: milestone.amount,
                  milestone: milestone.id,
                })
              }
            >
              {milestone.title}
              <span className="text-faint"> · {formatMoney(milestone.amount)}</span>
            </Chip>
          ))}
        </Row>
      ) : null}

      {billable.length > 0 ? (
        <Row label="Materials">
          {billable.map((material) => (
            <Chip
              key={`x${material.id}`}
              used={taken.materials.has(material.id)}
              onClick={() =>
                onPick({
                  description: material.name,
                  quantity: "1",
                  unit: material.unit,
                  rate: material.price ?? "0",
                  material: material.id,
                })
              }
            >
              {material.name}
              <span className="text-faint"> · {formatMoney(material.price)}</span>
            </Chip>
          ))}
        </Row>
      ) : null}

      <button type="button" onClick={onBlank} className="btn-quiet min-h-[36px] py-1.5">
        <Plus aria-hidden size={14} strokeWidth={2} />
        Blank line
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <span className="w-16 shrink-0 text-[0.75rem] text-faint">{label}</span>
      <span className="flex min-w-0 flex-1 flex-wrap gap-2">{children}</span>
    </div>
  );
}

function Chip({
  used,
  onClick,
  children,
}: {
  used: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={used ? "Already on this invoice — press to add it again" : undefined}
      className={`rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors
                  duration-150 ${
                    used
                      ? "border-ruleSoft text-faint line-through"
                      : "border-rule bg-card text-ink hover:border-brand"
                  }`}
    >
      {children}
    </button>
  );
}

/**
 * The lines themselves.
 *
 * A table from sm up and a stack of cards below it. A five-column table on a
 * 390px screen gives the description forty pixels, and the description is the
 * only column anybody reads.
 */
function LineTable({
  lines,
  rates,
  onChange,
  onRemove,
}: {
  lines: InvoiceLine[];
  rates: TaxRate[];
  onChange: (index: number, patch: Partial<InvoiceLine>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ul className="space-y-3">
      {lines.map((line, index) => {
        const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
        return (
          <li
            key={index}
            className="grid gap-3 border-t border-ruleSoft pt-3
                       sm:grid-cols-[minmax(0,1fr)_5rem_7rem_9rem_2.75rem] sm:items-start sm:gap-2"
          >
            <Cell label="Description">
              <input
                type="text"
                value={line.description}
                onChange={(event) =>
                  onChange(index, { description: event.target.value })
                }
                placeholder="What this is for"
                className="field"
              />
            </Cell>

            <Cell label="Qty">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={line.quantity}
                onChange={(event) => onChange(index, { quantity: event.target.value })}
                className="field text-right tabular-nums"
              />
            </Cell>

            <Cell label="Rate">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={line.rate}
                onChange={(event) => onChange(index, { rate: event.target.value })}
                placeholder="0"
                className="field text-right tabular-nums"
              />
            </Cell>

            <Cell label="Tax">
              {/* choicesFor carries a rate that is no longer offered rather
                  than dropping the line to nil, which would restate a bill
                  being edited after a slab changed. */}
              <Select
                value={line.tax_percent}
                onChange={(percent) => onChange(index, { tax_percent: percent })}
                choices={choicesFor(rates, line.tax_percent, "No tax")}
                placeholder="No tax"
              />
            </Cell>

            <div className="flex items-center justify-between gap-3 sm:justify-end sm:pt-3">
              {/* The line's own figure, on the phone layout only: in the
                  table the totals block below carries it. */}
              <span className="text-[0.875rem] tabular-nums sm:hidden">
                {formatMoney(String(amount))}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label="Remove this line"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                           text-faint transition-colors duration-150 hover:bg-paper
                           hover:text-ink"
              >
                <Trash2 aria-hidden size={15} strokeWidth={1.75} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A labelled field in the stack, unlabelled in the table. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow block sm:hidden">{label}</span>
      <span className="mt-1.5 block sm:mt-0">{children}</span>
    </label>
  );
}

function Totals({
  subtotal,
  tax,
  total,
}: {
  subtotal: number;
  tax: number;
  total: number;
}) {
  return (
    <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t border-rule pt-3 text-[0.9375rem]">
      <Line label="Subtotal" value={subtotal} />
      <Line label="Tax" value={tax} />
      <div className="flex justify-between gap-4 border-t border-rule pt-2 font-medium">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatMoney(String(total))}</dd>
      </div>
    </dl>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 text-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoney(String(value))}</dd>
    </div>
  );
}
