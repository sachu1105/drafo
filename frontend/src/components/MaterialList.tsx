"use client";

import { useEffect, useRef, useState } from "react";
import { InvoiceLink } from "@/components/InvoiceLink";
import { formatDate, formatMoney } from "@/lib/format";
import type { Material } from "@/lib/types";

/**
 * The client's material list, and the detail behind each row.
 *
 * A 56px thumbnail is enough to recognise a tile you already chose and not
 * nearly enough to judge one, which is what a client is actually doing here --
 * a year later, on a phone, deciding whether the skirting in the photo is the
 * skirting in the hall. So the row stays scannable and one tap opens the
 * photo at full width with everything recorded about it.
 *
 * Tapping a picture to enlarge it is the one interaction this audience does
 * every day in WhatsApp, which is the only app we can assume they know.
 *
 * A native <dialog> rather than a hand-rolled overlay: Escape, the focus trap,
 * inertness of the page behind and the backdrop are all the platform's job,
 * and all four are things a hand-rolled one gets wrong.
 */
export function MaterialList({ materials }: { materials: Material[] }) {
  const [open, setOpen] = useState<Material | null>(null);

  // Grouped so that a year of decisions is findable in one glance -- which is
  // the whole reason this section exists.
  const groups = new Map<string, Material[]>();
  for (const material of materials) {
    const list = groups.get(material.category_label) ?? [];
    list.push(material);
    groups.set(material.category_label, list);
  }

  return (
    <>
      <div className="space-y-7">
        {[...groups.entries()].map(([category, items]) => (
          <div key={category}>
            <h3 className="eyebrow mb-1">{category}</h3>
            <div>
              {items.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => setOpen(material)}
                  className="flex w-full items-center gap-4 border-b border-ruleSoft
                             py-3.5 text-left transition-colors duration-150
                             hover:bg-card"
                >
                  {material.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={material.photo_url}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 object-cover"
                    />
                  ) : (
                    <div aria-hidden className="h-14 w-14 shrink-0 bg-sand" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] leading-snug">{material.name}</p>
                    {material.brand ? (
                      <p className="text-[0.8125rem] text-muted">{material.brand}</p>
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

                  <span aria-hidden className="shrink-0 text-faint">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <MaterialDialog material={open} onClose={() => setOpen(null)} />
    </>
  );
}

function MaterialDialog({
  material,
  onClose,
}: {
  material: Material | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (material && !node.open) node.showModal();
    if (!material && node.open) node.close();
  }, [material]);

  const rows: [string, React.ReactNode][] = material
    ? (
        [
          ["Category", material.category_label],
          ["Brand", material.brand],
          [
            "Price",
            material.price
              ? `${formatMoney(material.price)}${material.unit ? ` ${material.unit}` : ""}`
              : "",
          ],
          ["Chosen", formatDate(material.selected_at ?? material.created_at)],
          ["Notes", material.notes],
        ] as [string, React.ReactNode][]
      ).filter(([, value]) => Boolean(value))
    : [];

  return (
    <dialog
      ref={ref}
      // Escape and the backdrop both fire `close`, so state is synced here
      // rather than in three separate handlers.
      onClose={onClose}
      // A click that lands on the dialog itself is a click on the backdrop:
      // anything inside is a child and reports itself as the target.
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className="w-[min(34rem,calc(100vw-2rem))] border border-rule bg-paper p-0
                 text-ink backdrop:bg-ink/50"
    >
      {material ? (
        <div>
          {material.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={material.photo_url}
              alt={material.name}
              className="max-h-[60vh] w-full bg-sand object-contain"
            />
          ) : null}

          <div className="p-5 sm:p-6">
            <h2 className="font-display text-[1.375rem] leading-snug">
              {material.name}
            </h2>

            {rows.length ? (
              <dl className="mt-4 space-y-2.5">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex gap-4 text-[0.9375rem]">
                    <dt className="w-24 shrink-0 text-muted">{label}</dt>
                    <dd className="min-w-0 flex-1 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {material.invoice_url ? (
              <div className="mt-4">
                <InvoiceLink material={material} />
              </div>
            ) : null}

            {/* Full width and 48px tall: this is the only way out on a phone,
                and the backdrop is not a discoverable one. */}
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="mt-6 flex min-h-[48px] w-full items-center justify-center
                         border border-rule bg-card text-[0.9375rem]
                         transition-colors duration-150 hover:border-brand"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
