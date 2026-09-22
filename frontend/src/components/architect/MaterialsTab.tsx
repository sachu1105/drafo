"use client";

import { useEffect, useState } from "react";
import { FileField } from "@/components/architect/FileField";
import {
  Empty,
  FormActions,
  FormCard,
  FormGrid,
  Labelled,
  MoneyInput,
} from "@/components/architect/Form";
import { api } from "@/lib/api";
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
          <div className="space-y-8">
            {[...groups.entries()].map(([category, items]) => (
              <section key={category}>
                <h3 className="eyebrow">{category}</h3>
                <ul className="mt-3 space-y-px bg-rule">
                  {items.map((material) => (
                    <li
                      key={material.id}
                      className="flex items-start gap-4 bg-card px-4 py-3.5"
                    >
                      {material.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={material.photo_url}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 shrink-0 border border-ruleSoft object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="h-14 w-14 shrink-0 border border-dashed border-rule"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-[0.9375rem] leading-snug">
                          {material.name}
                        </p>
                        {material.brand ? (
                          <p className="text-[0.8125rem] text-muted">
                            {material.brand}
                          </p>
                        ) : null}
                        {material.notes ? (
                          <p className="mt-1 text-[0.8125rem] leading-relaxed text-faint">
                            {material.notes}
                          </p>
                        ) : null}
                      </div>

                      {material.price ? (
                        <div className="shrink-0 text-right">
                          <p className="text-[0.9375rem] tabular-nums">
                            {formatMoney(material.price)}
                          </p>
                          {material.unit ? (
                            <p className="text-[0.75rem] text-faint">
                              {material.unit}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => remove(material)}
                        className="shrink-0 self-start text-[0.8125rem] text-faint
                                   hover:text-ink"
                      >
                        Remove
                      </button>
                    </li>
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
  const [busy, setBusy] = useState(false);

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

    setBusy(true);
    try {
      await api<Material>(`/projects/${projectId}/materials/`, {
        method: "POST",
        body: payload,
      });
      setForm(BLANK);
      setPhoto(null);
      onDone();
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

        <Labelled label="Photo" span={12}>
          <FileField
            file={photo}
            onFile={setPhoto}
            accept="image/png,image/jpeg"
            hint="PNG or JPG, optional"
            disabled={busy}
          />
        </Labelled>
      </FormGrid>

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
