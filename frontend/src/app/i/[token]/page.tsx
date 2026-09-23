import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { fetchClientData } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { ClientInvoice } from "@/lib/types";

/**
 * An invoice, as the person paying it reads it.
 *
 * Its own page on its own token, reached by nothing else. Sending somebody a
 * bill should not hand them the drawings, and the whole reason an invoice
 * carries a token of its own is that the two are different conversations.
 *
 * Rendered on the server, like the project page, so it arrives complete on a
 * phone with no spinner -- and because this is a document, and a document
 * that assembles itself in front of you is not one.
 *
 * There is no PDF endpoint behind the Download button. The page *is* the PDF:
 * it is laid out for A4 in the print stylesheet below, and the browser's own
 * print engine writes the file. That keeps the saved copy identical to what
 * was on screen -- a separate server-side renderer is a second implementation
 * of the same document, and the two drift.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const invoice = await fetchClientData<ClientInvoice>(`/api/i/${token}/`);
  if (!invoice) return { title: "Not found" };

  return {
    // The practice's name, not ours. This is their document.
    title: `${invoice.kind_label} ${invoice.number} — ${invoice.from_name}`,
    robots: { index: false, follow: false },
  };
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await fetchClientData<ClientInvoice>(`/api/i/${token}/`);
  if (!invoice) notFound();

  const taxed = Number(invoice.tax_total) > 0;

  return (
    <main className="mx-auto max-w-sheet px-4 py-8 sm:px-8 sm:py-12 print:max-w-none print:p-0">
      {/* Everything in this bar is for the person holding the link, not for
          the document. It is the first thing the print stylesheet removes. */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-[0.875rem] text-muted">
          {invoice.kind === "estimate"
            ? "An estimate for your project."
            : "An invoice for your project."}{" "}
          Keep this link private.
        </p>
        <PrintButton />
      </div>

      <article className="border border-rule bg-card p-6 sm:p-10 print:border-0 print:p-0">
        {/* --- the heading -------------------------------------------------
            The word first and very large, because the first thing anyone
            needs from a document like this is to know which kind it is.
            An estimate mistaken for an invoice gets paid; an invoice
            mistaken for an estimate does not. */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-rule pb-6">
          <div className="min-w-0">
            <h1 className="font-display text-[2.5rem] leading-none tracking-tight sm:text-[3rem]">
              {invoice.kind_label}
            </h1>
            <p className="mt-3 text-[0.9375rem] text-muted">
              {invoice.project_name}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {invoice.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invoice.logo_url}
                alt={invoice.from_name}
                className="mb-3 ml-auto h-12 w-auto object-contain"
              />
            ) : null}
            <p className="text-[0.875rem] text-muted">
              {formatDate(invoice.issued_on)}
            </p>
            <p className="text-[0.9375rem] font-medium">
              {invoice.kind_label} No. {invoice.number}
            </p>
            {invoice.due_on ? (
              <p className="mt-1 text-[0.875rem] text-muted">
                Due {formatDate(invoice.due_on)}
              </p>
            ) : null}
          </div>
        </header>

        {/* --- the two parties --------------------------------------------- */}
        <div className="grid gap-8 border-b border-rule py-6 sm:grid-cols-2">
          <Party
            label="From"
            name={invoice.from_name}
            address={invoice.from_address}
            phone={invoice.from_phone}
            email={invoice.from_email}
            gstin={invoice.from_gstin}
          />
          <Party
            label="Billed to"
            name={invoice.to_name}
            address={invoice.to_address}
            phone={invoice.to_phone}
            email={invoice.to_email}
            gstin={invoice.to_gstin}
          />
        </div>

        {/* --- the lines ---------------------------------------------------
            A real table, not a grid of divs. It is tabular data, it has to
            survive a page break in print, and a screen reader should be able
            to say which column a figure is in. */}
        <table className="mt-6 w-full border-collapse text-[0.9375rem]">
          <thead>
            <tr className="border-b border-rule text-left">
              <Th>Description</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Rate</Th>
              {taxed ? <Th align="right">Tax</Th> : null}
              <Th align="right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index} className="border-b border-ruleSoft align-top">
                <td className="py-3 pr-4">
                  {line.description}
                  {line.unit ? (
                    <span className="block text-[0.8125rem] text-faint">
                      {line.unit}
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pl-2 text-right tabular-nums">
                  {trim(line.quantity)}
                </td>
                <td className="py-3 pl-2 text-right tabular-nums">
                  {formatMoney(line.rate)}
                </td>
                {taxed ? (
                  <td className="py-3 pl-2 text-right tabular-nums text-muted">
                    {trim(line.tax_percent)}%
                  </td>
                ) : null}
                <td className="py-3 pl-2 text-right tabular-nums">
                  {formatMoney(line.amount ?? "0")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* --- what is owed ------------------------------------------------ */}
        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-[0.9375rem]">
            <Total label="Subtotal" value={invoice.subtotal} />
            <Total label="Tax" value={invoice.tax_total} />
            <div className="flex justify-between gap-6 border-t border-rule pt-2.5 text-[1.125rem] font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(invoice.total)}</dd>
            </div>
          </dl>
        </div>

        {invoice.notes ? (
          <p className="mt-8 max-w-reading whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted">
            {invoice.notes}
          </p>
        ) : null}

        {/* --- the footer: how to pay, and on what terms ------------------- */}
        {invoice.from_bank || invoice.terms ? (
          <div className="mt-10 grid gap-8 border-t border-rule pt-6 sm:grid-cols-2">
            {invoice.from_bank ? (
              <Block label="Payment information" body={invoice.from_bank} />
            ) : null}
            {invoice.terms ? <Block label="Terms" body={invoice.terms} /> : null}
          </div>
        ) : null}
      </article>
    </main>
  );
}

function Party({
  label,
  name,
  address,
  phone,
  email,
  gstin,
}: {
  label: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
}) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[0.9375rem] font-medium">{name}</p>
      {address ? (
        <p className="mt-1 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-muted">
          {address}
        </p>
      ) : null}
      {phone ? <p className="text-[0.875rem] text-muted">{phone}</p> : null}
      {email ? (
        <p className="break-words text-[0.875rem] text-muted">{email}</p>
      ) : null}
      {gstin ? (
        <p className="mt-1 text-[0.875rem] text-muted">GSTIN: {gstin}</p>
      ) : null}
    </div>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-muted">
        {body}
      </p>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`pb-2 text-[0.75rem] font-medium uppercase tracking-[0.1em] text-faint ${
        align === "right" ? "pl-2 text-right" : "pr-4"
      }`}
    >
      {children}
    </th>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 text-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}

/**
 * "3.00" is a quantity somebody typed as 3.
 *
 * Money keeps its decimals -- a price is always two places -- but a quantity
 * and a tax rate read as numbers, and "1.00 per sq ft at 18.00%" is a form
 * field leaking onto a document.
 */
function trim(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : value;
}
