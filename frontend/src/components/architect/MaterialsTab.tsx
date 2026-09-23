"use client";

import { useEffect, useState } from "react";
import { FileField } from "@/components/architect/FileField";
import { InvoiceLink } from "@/components/InvoiceLink";
import {
  Empty,
  FormActions,
  FormCard,
  FormGrid,
  Labelled,
  MoneyInput,
} from "@/components/architect/Form";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Material, MaterialCategory } from "@/lib/types";

const CATEGORIES: { value: MaterialCategory; label: string }[] = [
  { value: "flooring", label: "Flooring" },
  { value: "sanitary", label: "Sanitary" },
  { value: "electrical", label: "Electrical" },
  { value: "paint", label: "Paint" },
  { value: "joinery", label: "Joinery" },
  { value: "hardware", label: "Hardware" },
  { value: "furniture", label: "Furniture" },
  { value: "other", label: "Other" },
];

const BLANK = {
  category: "flooring" as MaterialCategory,
  name: "",
  brand: "",
  price: "",
  unit: "",
  notes: "",
};

export function MaterialsTab({
  projectId,
  onChanged,
}: {
  projectId: number;
  onChanged?: () => void;
}) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setMaterials(await api<Material[]>(`/projects/${projectId}/materials/`));
  }

  useEffect(() => {
    load().catch(() => setMaterials([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function refresh() {
    await load();
    onChanged?.();
  }

  async function remove(material: Material) {
    await api<void>(`/materials/${material.id}/`, { method: "DELETE" });
    await refresh();
  }

  // Grouped, because the point of this list is finding a decision a year later.
  const groups = new Map<string, Material[]>();
  for (const material of materials ?? []) {
    const list = groups.get(material.category_label) ?? [];
    list.push(material);
    groups.set(material.category_label, list);
  }

  return (
    <div>
      {/* No heading and no blurb: the tab that was clicked to get here is
          called Materials, and the button is only offered when there is
          already a list to add to -- an empty tab makes the offer once, in
          the middle of the screen, not twice. */}
      {!adding && (materials?.length ?? 0) > 0 ? (
        <div className="mb-5 flex justify-end">
          <button type="button" onClick={() => setAdding(true)} className="btn-quiet">
            Add material
          </button>
        </div>
      ) : null}

      {adding ? (
        <AddMaterialForm
          projectId={projectId}
          onDone={async () => {
            setAdding(false);
            await refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      <div className={adding ? "mt-6" : ""}>
        {materials === null ? (
          <p className="text-[0.875rem] text-faint">Loading…</p>
        ) : materials.length === 0 ? (
          !adding ? (
            <Empty
              title="Nothing recorded yet"
              action="Add a material"
              onAction={() => setAdding(true)}
            />
          ) : null
        ) : (
          /* One list, not three floating slabs. The categories are
             subheadings inside it rather than captions above separate cards,
             so a project's selections read as one inventory -- which is what
             somebody is scanning a year later.

             No frame and no filled bands: a box around a list that already
             runs the width of the page only draws a second edge just inside
             the first, and the rows are what matter. The hairlines stay --
             they are what lets the eye track a name across to its price --
             but everything else comes off, and the rows start at the page's
             own margin rather than inset from a border. */
          <div>
            {[...groups.entries()].map(([category, items], index) => (
              <section key={category}>
                <h3
                  className={`eyebrow ${index > 0 ? "mt-10" : ""} pb-2`}
                >
                  {category}
                </h3>
                <ul>
                  {items.map((material) => (
                    <MaterialRow
                      key={material.id}
                      material={material}
                      onRemove={() => remove(material)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One selection.
 *
 * Two lines at most: what it is, then everything else about it joined on one
 * muted line. The price sits in a column of fixed width so that a column of
 * them lines up on the rupee sign instead of ending wherever the name did.
 */
function MaterialRow({
  material,
  onRemove,
}: {
  material: Material;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const meta = [material.brand, material.notes].filter(Boolean).join(" · ");

  if (confirming) {
    return (
      <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ruleSoft py-3.5">
        <p className="min-w-0 flex-1 text-[0.875rem]">
          Remove <span className="font-medium">{material.name}</span>?
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRemove}
            className="min-h-[36px] border border-ink px-3 text-[0.8125rem]"
          >
            Remove
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
    <li className="group flex items-start gap-4 border-t border-ruleSoft py-3.5 sm:items-center">
      <Thumbnail url={material.photo_url} />

      <div className="min-w-0 flex-1">
        {/* Wraps rather than truncates. At 390px a fixed price column beside
            it left about a hundred pixels for the name, and every row came
            out as "Modular swi…". */}
        <p className="break-words text-[0.9375rem] leading-snug">{material.name}</p>
        {meta || material.invoice_url ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-muted">
            {/* No middot between these two: the line wraps, and a separator
                that ends up alone at the end of a line is litter. The gap and
                the document icon are separation enough. */}
            {meta ? <span>{meta}</span> : null}
            <InvoiceLink material={material} />
          </p>
        ) : null}

        {/* On a phone the price goes under the name, where the name can have
            the whole width. From sm up it is a column of its own. */}
        {material.price ? (
          <p className="mt-1 text-[0.875rem] tabular-nums sm:hidden">
            {formatMoney(material.price)}
            {material.unit ? (
              <span className="text-[0.75rem] text-faint"> {material.unit}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="hidden w-28 shrink-0 text-right sm:block">
        {material.price ? (
          <>
            <p className="text-[0.9375rem] tabular-nums">
              {formatMoney(material.price)}
            </p>
            {material.unit ? (
              <p className="text-[0.75rem] text-faint">{material.unit}</p>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Quiet but always there. Hover-only would hide it on every phone,
          and a one-tap delete of something the client can see should ask. */}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${material.name}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center text-faint
                   transition-colors duration-150 hover:bg-paper hover:text-ink"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5">
          <path
            d="M3.5 3.5l9 9M12.5 3.5l-9 9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </li>
  );
}

/** The material, small. A filled frame rather than a dashed empty one. */
function Thumbnail({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="h-12 w-12 shrink-0 border border-ruleSoft bg-sand"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      className="h-12 w-12 shrink-0 border border-ruleSoft object-cover"
    />
  );
}

function AddMaterialForm({
  projectId,
  onDone,
  onCancel,
}: {
  projectId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(BLANK);
  const [photo, setPhoto] = useState<File | null>(null);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;

    const payload = new FormData();
    payload.append("category", form.category);
    payload.append("name", form.name.trim());
    for (const field of ["brand", "price", "unit", "notes"] as const) {
      if (form[field].trim()) payload.append(field, form[field].trim());
    }
    if (photo) payload.append("photo", photo);
    if (invoice) payload.append("invoice", invoice);

    setBusy(true);
    setError(null);
    try {
      await api<Material>(`/projects/${projectId}/materials/`, {
        method: "POST",
        body: payload,
      });
      setForm(BLANK);
      setPhoto(null);
      setInvoice(null);
      onDone();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not add that.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormCard onSubmit={submit}>
      <FormGrid>
        <Labelled label="Category" span={4}>
          <select
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value as MaterialCategory })
            }
            className="select"
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Item" span={8}>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="600×600 vitrified tile, matt ivory"
            autoFocus
            className="field"
          />
        </Labelled>

        <Labelled label="Brand" span={4}>
          <input
            type="text"
            value={form.brand}
            onChange={(event) => setForm({ ...form, brand: event.target.value })}
            placeholder="Optional"
            className="field"
          />
        </Labelled>

        <Labelled label="Price" span={4}>
          <MoneyInput
            value={form.price}
            onChange={(price) => setForm({ ...form, price })}
          />
        </Labelled>

        <Labelled label="Unit" span={4}>
          <input
            type="text"
            value={form.unit}
            onChange={(event) => setForm({ ...form, unit: event.target.value })}
            placeholder="per sq ft"
            className="field"
          />
        </Labelled>

        <Labelled label="Note" span={12}>
          <input
            type="text"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Living and dining only"
            className="field"
          />
        </Labelled>

        <Labelled label="Photo" span={6}>
          <FileField
            file={photo}
            onFile={setPhoto}
            accept="image/png,image/jpeg"
            hint="PNG or JPG, optional"
            disabled={busy}
          />
        </Labelled>

        <Labelled label="Invoice" span={6}>
          <FileField
            file={invoice}
            onFile={setInvoice}
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            hint="PDF, PNG or JPG, optional — your client can open it"
            disabled={busy}
          />
        </Labelled>
      </FormGrid>

      {error ? (
        <p role="alert" className="mt-4 text-[0.875rem] text-ink">
          {error}
        </p>
      ) : null}

      <FormActions
        submitLabel="Add material"
        busyLabel="Saving…"
        busy={busy}
        disabled={!form.name.trim()}
        onCancel={onCancel}
      />
    </FormCard>
  );
}
