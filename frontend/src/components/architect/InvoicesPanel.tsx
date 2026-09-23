"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Link2, Pencil, Send, Trash2 } from "lucide-react";
import { InvoiceBuilder } from "@/components/architect/InvoiceBuilder";
import { api, ApiError } from "@/lib/api";
import { me } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import type {
  Invoice,
  InvoiceKind,
  InvoiceSummary,
  Material,
  Milestone,
} from "@/lib/types";

/**
 * Invoices and estimates for one project.
 *
 * Sits under the payment stages rather than in a tab of its own, because the
 * question "what have I billed" is the same question as "what am I owed" and
 * splitting them puts half the answer one click away.
 *
 * A draft is private. Its link returns nothing until it is sent, so an
 * architect can build a bill over two sittings without a client refreshing
 * into a half-finished document.
 */
export function InvoicesPanel({
  projectId,
  milestones,
}: {
  projectId: number;
  milestones: Milestone[];
}) {
  const [invoices, setInvoices] = useState<InvoiceSummary[] | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  // The rate a new line starts at, which is a fact about the practice. Read
  // here rather than threaded down from the project page, which has no reason
  // to know about tax.
  const [defaultTaxPercent, setDefaultTaxPercent] = useState("0");
  /** "invoice" or "estimate" while raising a new one; null otherwise. */
  const [making, setMaking] = useState<InvoiceKind | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setInvoices(await api<InvoiceSummary[]>(`/projects/${projectId}/invoices/`));
  }

  useEffect(() => {
    load().catch(() => setInvoices([]));
    // The builder bills for materials as well as stages, so it needs them.
    api<Material[]>(`/projects/${projectId}/materials/`)
      .then(setMaterials)
      .catch(() => setMaterials([]));
    me()
      .then((architect) =>
        setDefaultTaxPercent(architect.default_tax_percent ?? "0"),
      )
      .catch(() => setDefaultTaxPercent("0"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function act(what: () => Promise<unknown>) {
    setError(null);
    try {
      await what();
      await load();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "That did not work.",
      );
    }
  }

  const list = invoices ?? [];
  const open = making !== null || editing !== null;

  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-8">
        <h3 className="eyebrow">Invoices and estimates</h3>
        {!open ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMaking("estimate")}
              className="btn-quiet min-h-[38px] py-1.5 text-[0.875rem]"
            >
              New estimate
            </button>
            <button
              type="button"
              onClick={() => setMaking("invoice")}
              className="btn-quiet min-h-[38px] py-1.5 text-[0.875rem]"
            >
              New invoice
            </button>
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="mb-6">
          <InvoiceBuilder
            projectId={projectId}
            kind={editing ? editing.kind : making!}
            invoice={editing ?? undefined}
            milestones={milestones}
            materials={materials}
            defaultTaxPercent={defaultTaxPercent}
            onDone={async () => {
              setMaking(null);
              setEditing(null);
              await load();
            }}
            onCancel={() => {
              setMaking(null);
              setEditing(null);
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mb-3 text-[0.875rem] text-ink">
          {error}
        </p>
      ) : null}

      {invoices === null ? (
        <p className="text-[0.875rem] text-faint">Loading…</p>
      ) : list.length === 0 ? (
        !open ? (
          <p className="border border-dashed border-rule bg-paper px-4 py-8 text-center text-[0.875rem] text-faint">
            Nothing billed yet. An estimate is a quote you can send before the
            work; an invoice is the bill for it.
          </p>
        ) : null
      ) : (
        <ul className="space-y-px bg-rule">
          {list.map((invoice) => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              onEdit={async () => {
                const full = await api<Invoice>(`/invoices/${invoice.id}/`);
                setMaking(null);
                setEditing(full);
              }}
              onSend={() => act(() => api(`/invoices/${invoice.id}/send/`, { method: "POST" }))}
              onConvert={() =>
                act(() => api(`/invoices/${invoice.id}/convert/`, { method: "POST" }))
              }
              onRemove={() =>
                act(() => api(`/invoices/${invoice.id}/`, { method: "DELETE" }))
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function InvoiceRow({
  invoice,
  onEdit,
  onSend,
  onConvert,
  onRemove,
}: {
  invoice: InvoiceSummary;
  onEdit: () => void;
  onSend: () => void;
  onConvert: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const draft = invoice.status === "draft";

  if (confirming) {
    return (
      <li className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-4 py-4">
        <p className="min-w-0 flex-1 text-[0.875rem]">
          Delete <span className="font-medium">{invoice.number}</span>? If it has
          been sent, the client&rsquo;s link stops working.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRemove}
            className="min-h-[36px] rounded-full border border-ink px-3 text-[0.8125rem]"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-[36px] px-2 text-[0.8125rem] text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-card px-4 py-4">
      <FileText
        aria-hidden
        size={18}
        strokeWidth={1.5}
        className="shrink-0 text-faint"
      />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[0.9375rem]">
          <span className="font-medium">{invoice.number}</span>
          <StatusChip invoice={invoice} />
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {invoice.to_name}
          <span className="text-faint"> · </span>
          {formatDate(invoice.issued_on)}
          {invoice.due_on ? (
            <>
              <span className="text-faint"> · </span>
              due {formatDate(invoice.due_on)}
            </>
          ) : null}
        </p>
      </div>

      <p className="shrink-0 text-[1.0625rem] tabular-nums">
        {formatMoney(invoice.total)}
      </p>

      <div className="flex shrink-0 items-center gap-1">
        {/* A draft can still be built on; a sent one is a document somebody
            may already have filed, so editing it is deliberately not offered
            here -- raise a new one. */}
        {draft ? (
          <Action label="Edit" icon={Pencil} onClick={onEdit} />
        ) : (
          <CopyLink url={invoice.client_url} />
        )}
        {draft ? (
          <Action label="Send to client" icon={Send} onClick={onSend} />
        ) : null}
        {invoice.kind === "estimate" && !draft ? (
          <Action label="Turn into an invoice" icon={Check} onClick={onConvert} />
        ) : null}
        <Action
          label="Delete"
          icon={Trash2}
          onClick={() => setConfirming(true)}
        />
      </div>
    </li>
  );
}

function StatusChip({ invoice }: { invoice: InvoiceSummary }) {
  const tone =
    invoice.status === "paid"
      ? "bg-accentSoft text-accent"
      : invoice.status === "draft"
        ? "border border-rule text-faint"
        : "border border-brand text-brand";

  return (
    <span className={`chip ${tone}`}>
      {invoice.kind === "estimate" ? "Estimate" : invoice.status_label}
    </span>
  );
}

function Action({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-faint
                 transition-colors duration-150 hover:bg-paper hover:text-ink"
    >
      <Icon aria-hidden size={15} strokeWidth={1.75} />
    </button>
  );
}

/**
 * Copy the client's link.
 *
 * The confirmation is the icon becoming a tick for a moment. A clipboard
 * write is silent, and without a reply the architect presses it three times
 * and still does not know whether it worked.
 */
function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={copied ? "Link copied" : "Copy the client link"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard refused, usually an insecure origin. The link is on the
          // invoice page itself, so there is another way through.
          window.open(url, "_blank", "noopener");
        }
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors
                  duration-150 hover:bg-paper ${copied ? "text-accent" : "text-faint hover:text-ink"}`}
    >
      {copied ? (
        <Check aria-hidden size={15} strokeWidth={2} />
      ) : (
        <Link2 aria-hidden size={15} strokeWidth={1.75} />
      )}
    </button>
  );
}
