"use client";

import { useEffect, useId, useState } from "react";
import { Pencil, X } from "lucide-react";
import { FileField } from "@/components/architect/FileField";
import { ImagesField } from "@/components/architect/ImagesField";
import { Select } from "@/components/architect/Select";
import { UnitField } from "@/components/architect/UnitField";
import { IconButton } from "@/components/IconButton";
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
import type {
  Material,
  MaterialCategory,
  MaterialPhoto,
  Unit,
} from "@/lib/types";

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

// Kept in step with MAX_MATERIAL_PHOTOS in portal/serializers.py, which
// remains the gate. This only saves the architect a failed upload.
const MAX_PHOTOS = 8;

const BLANK = {
  category: "flooring" as MaterialCategory,
  name: "",
  brand: "",
  price: "",
  unit: "",
  notes: "",
};

/** The form's fields for a material, or an empty set of them for a new one. */
function draftOf(material: Material | undefined): typeof BLANK {
  if (!material) return BLANK;
  return {
    category: material.category,
    name: material.name,
    brand: material.brand,
    // The API sends "2000.00" and the box should not say that back.
    price: material.price ? String(Number(material.price)) : "",
    unit: material.unit,
    notes: material.notes,
  };
}

export function MaterialsTab({
  projectId,
  onChanged,
}: {
  projectId: number;
  onChanged?: () => void;
}) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  // Fetched once here rather than inside each form: the list is the same for
  // every row, and an edit form should open with its dropdown already filled.
  const [units, setUnits] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  /** Which row is open for editing. One at a time: two half-finished edits
      on one screen is a way to save the wrong one. */
  const [editingId, setEditingId] = useState<number | null>(null);

  async function load() {
    setMaterials(await api<Material[]>(`/projects/${projectId}/materials/`));
  }

  useEffect(() => {
    load().catch(() => setMaterials([]));
    // A failure here costs the dropdown, not the form: the unit box falls
    // back to being typed, which it accepts anyway.
    api<Unit[]>("/units/")
      .then((loaded) => setUnits(loaded.map((unit) => unit.label)))
      .catch(() => setUnits([]));
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
        <MaterialForm
          projectId={projectId}
          units={units}
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
                  {items.map((material) =>
                    /* The form takes the row's place rather than opening
                       above the list. What is being changed stays where it
                       was found, and nothing below it moves. */
                    editingId === material.id ? (
                      <li key={material.id} className="border-t border-ruleSoft py-3.5">
                        <MaterialForm
                          projectId={projectId}
                          units={units}
                          material={material}
                          onDone={async () => {
                            setEditingId(null);
                            await refresh();
                          }}
                          onCancel={async () => {
                            setEditingId(null);
                            // A removed picture is already gone from the
                            // server, so the list has to be told.
                            await refresh();
                          }}
                        />
                      </li>
                    ) : (
                      <MaterialRow
                        key={material.id}
                        material={material}
                        onEdit={() => {
                          setAdding(false);
                          setEditingId(material.id);
                        }}
                        onRemove={() => remove(material)}
                      />
                    ),
                  )}
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
  onEdit,
  onRemove,
}: {
  material: Material;
  onEdit: () => void;
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
      <Thumbnail
        url={material.photos[0]?.url ?? null}
        extra={material.photos.length - 1}
      />

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

      {/* Quiet but always there. Hover-only would hide both of these on
          every phone, and a one-tap delete of something the client can see
          should ask first. */}
      <div className="-my-1.5 flex shrink-0 items-center">
        <IconButton
          label={`Edit ${material.name}`}
          icon={Pencil}
          onClick={onEdit}
        />
        <IconButton
          label={`Remove ${material.name}`}
          icon={X}
          onClick={() => setConfirming(true)}
        />
      </div>
    </li>
  );
}

/** The material, small. A filled frame rather than a dashed empty one.
 *
 * `extra` is how many more pictures there are behind this one. Shown as a
 * count in the corner rather than a second thumbnail: the row is a scan line,
 * and what it has to answer is "is there more to look at", not "what".
 */
function Thumbnail({ url, extra = 0 }: { url: string | null; extra?: number }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="h-12 w-12 shrink-0 border border-ruleSoft bg-sand"
      />
    );
  }
  return (
    <span className="relative h-12 w-12 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-12 w-12 border border-ruleSoft object-cover"
      />
      {extra > 0 ? (
        <span
          aria-label={`${extra + 1} pictures`}
          className="absolute -bottom-1 -right-1 flex h-5 min-w-[1.25rem] items-center
                     justify-center rounded-full bg-brand px-1 text-[0.625rem]
                     font-medium tabular-nums text-paper"
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Add a material, or change one. The same form both ways.
 *
 * They were never going to be two forms. Everything an architect can say
 * about a selection when it is first recorded, they can be wrong about later
 * -- a price agreed at the wrong figure, a tile that turned out to be the
 * matt one, a photograph taken before the sample arrived -- and a form that
 * can only create makes every one of those a delete and a retype.
 *
 * The one real difference is what empty means. Creating, an empty box is a
 * field not filled in and is left out of the request; editing, an empty box
 * is a field being cleared and has to be sent, or a brand typed by mistake
 * can never be removed.
 */
function MaterialForm({
  projectId,
  units,
  material,
  onDone,
  onCancel,
}: {
  projectId: number;
  units: string[];
  /** Present when editing. Absent when adding. */
  material?: Material;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = material !== undefined;
  const [form, setForm] = useState(() => draftOf(material));
  const [photos, setPhotos] = useState<File[]>([]);
  // Pictures already on the server, which are removed one request at a time
  // rather than as part of the save -- a picture the architect has just
  // deleted should not come back if they then cancel out of the form.
  const [kept, setKept] = useState<MaterialPhoto[]>(material?.photos ?? []);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unitsId = useId();
  const categoryId = useId();

  async function dropPhoto(photo: MaterialPhoto) {
    setKept((current) => current.filter((one) => one.id !== photo.id));
    try {
      await api<void>(`/materials/${material!.id}/photos/${photo.id}/`, {
        method: "DELETE",
      });
    } catch {
      // Put it back rather than lie about what is stored.
      setKept(material?.photos ?? []);
      setError("Could not remove that picture.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;

    const payload = new FormData();
    payload.append("category", form.category);
    payload.append("name", form.name.trim());
    for (const field of ["brand", "price", "unit", "notes"] as const) {
      const value = form[field].trim();
      if (value || editing) payload.append(field, value);
    }
    // One repeated key, which is what the serializer reads with getlist().
    for (const picture of photos) payload.append("photos", picture);
    if (invoice) payload.append("invoice", invoice);

    setBusy(true);
    setError(null);
    try {
      await api<Material>(
        editing
          ? `/materials/${material.id}/`
          : `/projects/${projectId}/materials/`,
        { method: editing ? "PATCH" : "POST", body: payload },
      );
      setForm(draftOf(undefined));
      setPhotos([]);
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
        <Labelled label="Category" span={4} htmlFor={categoryId}>
          <Select
            id={categoryId}
            value={form.category}
            onChange={(category) =>
              setForm({ ...form, category: category as MaterialCategory })
            }
            choices={CATEGORIES.map((category) => ({
              value: category.value,
              label: category.label,
            }))}
          />
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

        <Labelled label="Unit" span={4} htmlFor={unitsId}>
          <UnitField
            id={unitsId}
            value={form.unit}
            onChange={(unit) => setForm({ ...form, unit })}
            units={units}
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

        <Labelled label="Photos" span={6}>
          <ImagesField
            files={photos}
            onFiles={setPhotos}
            existing={kept}
            onRemoveExisting={dropPhoto}
            accept="image/png,image/jpeg,image/webp"
            hint="PNG, JPG or WEBP — the first one is the thumbnail"
            max={MAX_PHOTOS}
            disabled={busy}
          />
        </Labelled>

        <Labelled label="Invoice" span={6}>
          <FileField
            file={invoice}
            onFile={setInvoice}
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            hint={
              editing && material.invoice_name
                ? `Attached: ${material.invoice_name}. Choosing one replaces it.`
                : "PDF, PNG or JPG, optional — your client can open it"
            }
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
        submitLabel={editing ? "Save changes" : "Add material"}
        busyLabel="Saving…"
        busy={busy}
        disabled={!form.name.trim()}
        onCancel={onCancel}
      />
    </FormCard>
  );
}
