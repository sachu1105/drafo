"use client";

import { useEffect, useState } from "react";
import { FileField } from "@/components/architect/FileField";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-title">Materials</h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Every selection in one place, visible to your client.
          </p>
        </div>
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn-quiet">
            Add material
          </button>
        ) : null}
      </div>

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

      <div className="mt-6">
        {materials === null ? (
          <p className="text-[0.875rem] text-faint">Loading…</p>
        ) : materials.length === 0 ? (
          !adding ? (
            <div className="border border-dashed border-rule bg-card px-6 py-12 text-center">
              <p className="font-display text-[1.25rem]">Nothing recorded yet</p>
              <p className="mx-auto mt-2 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted">
                Tile, sanitary, switches, paint. This is where a year of
                decisions stops living in the chat thread.
              </p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="btn-primary mt-6"
              >
                Add the first material
              </button>
            </div>
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
                        className="shrink-0 self-center text-[0.8125rem] text-faint hover:text-ink"
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
    <form
      onSubmit={submit}
      className="mt-5 animate-rise space-y-5 border border-rule bg-card p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <label className="block">
          <span className="eyebrow block">Category</span>
          <select
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value as MaterialCategory })
            }
            className="field mt-2"
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="eyebrow block">Item</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="600×600 vitrified tile, matt ivory"
            autoFocus
            className="field mt-2"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="eyebrow block">Brand</span>
          <input
            type="text"
            value={form.brand}
            onChange={(event) => setForm({ ...form, brand: event.target.value })}
            className="field mt-2"
          />
        </label>
        <label className="block">
          <span className="eyebrow block">Price</span>
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
            className="field mt-2"
          />
        </label>
        <label className="block">
          <span className="eyebrow block">Unit</span>
          <input
            type="text"
            value={form.unit}
            onChange={(event) => setForm({ ...form, unit: event.target.value })}
            placeholder="per sq ft"
            className="field mt-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="eyebrow block">Note</span>
        <input
          type="text"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Living and dining only"
          className="field mt-2"
        />
      </label>

      <div>
        <span className="eyebrow block">Photo</span>
        <div className="mt-2">
          <FileField
            file={photo}
            onFile={setPhoto}
            accept="image/png,image/jpeg"
            hint="PNG or JPG — optional"
            disabled={busy}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-ruleSoft pt-4">
        <button
          type="submit"
          disabled={busy || !form.name.trim()}
          className="btn-primary"
        >
          {busy ? "Saving…" : "Add material"}
        </button>
        <button type="button" onClick={onCancel} className="btn-quiet">
          Cancel
        </button>
      </div>
    </form>
  );
}
