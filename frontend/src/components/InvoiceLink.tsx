import type { Material } from "@/lib/types";

/**
 * The invoice behind a material.
 *
 * Same component on the architect's list and on the client's page, because
 * the client seeing a different affordance from the one the architect
 * attached is how "I sent you the bill" becomes an argument.
 */
export function InvoiceLink({ material }: { material: Material }) {
  if (!material.invoice_url) return null;
  return (
    <a
      href={material.invoice_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[32px] items-center gap-1.5 text-[0.8125rem]
                 text-muted underline decoration-rule underline-offset-4
                 hover:text-ink"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0">
        <path
          d="M4.5 2h5l3 3v9a.5.5 0 0 1-.5.5H4.5a.5.5 0 0 1-.5-.5V2.5a.5.5 0 0 1 .5-.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 2v3.5H13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </svg>
      Invoice
    </a>
  );
}
