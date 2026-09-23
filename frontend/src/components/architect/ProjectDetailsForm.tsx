"use client";

import { useState } from "react";
import { FormActions, FormCard, FormGrid, Labelled } from "@/components/architect/Form";
import { Select } from "@/components/architect/Select";
import { api, ApiError } from "@/lib/api";
import type { Project, ProjectStatus } from "@/lib/types";

/**
 * Changing a project's details, and where it stands.
 *
 * The client's name, phone and address are the things this product prints on
 * an invoice and pastes into a WhatsApp message, and until now they could
 * only be set once, when the project was created. A typed phone number with a
 * digit missing was permanent.
 *
 * Status is here rather than as a control in the header. It is not a switch
 * that should be a thumb-width away from a page anybody opens forty times a
 * week -- marking a live job Completed by accident takes it out of the list
 * the architect works from.
 */

export const STATUSES: { value: ProjectStatus; label: string; note: string }[] = [
  { value: "active", label: "In progress", note: "The normal state of a live job" },
  { value: "on_hold", label: "On hold", note: "Stopped for now, will start again" },
  { value: "completed", label: "Completed", note: "Finished and handed over" },
  { value: "cancelled", label: "Cancelled", note: "Dropped, and will not resume" },
];

export function ProjectDetailsForm({
  project,
  onSaved,
  onCancel,
}: {
  project: Project;
  onSaved: (project: Project) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    client_name: project.client_name,
    client_phone: project.client_phone,
    client_email: project.client_email,
    address: project.address,
    status: project.status,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.client_name.trim()) return;

    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const saved = await api<Project>(`/projects/${project.id}/`, {
        method: "PATCH",
        body: {
          name: form.name.trim(),
          client_name: form.client_name.trim(),
          client_phone: form.client_phone.trim(),
          client_email: form.client_email.trim(),
          address: form.address.trim(),
          status: form.status,
        },
      });
      onSaved(saved);
    } catch (caught) {
      if (caught instanceof ApiError && caught.data && typeof caught.data === "object") {
        const found: Record<string, string> = {};
        for (const [key, value] of Object.entries(
          caught.data as Record<string, unknown>,
        )) {
          const message = Array.isArray(value) ? value[0] : value;
          if (typeof message === "string" && key !== "detail") found[key] = message;
        }
        setFieldErrors(found);
        if (Object.keys(found).length === 0) setError(caught.message);
      } else {
        setError("Could not save that.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormCard onSubmit={submit}>
      <FormGrid>
        <Labelled label="Project" span={8}>
          <input
            type="text"
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Villa at Kakkanad"
            required
            autoFocus
            maxLength={160}
            className={`field ${fieldErrors.name ? "border-ink" : ""}`}
          />
          <FieldError message={fieldErrors.name} />
        </Labelled>

        <Labelled label="Status" span={4}>
          <Select
            value={form.status}
            onChange={(status) => set("status", status as ProjectStatus)}
            choices={STATUSES}
          />
        </Labelled>

        <Labelled label="Client" span={6}>
          <input
            type="text"
            value={form.client_name}
            onChange={(event) => set("client_name", event.target.value)}
            placeholder="Mr Thomas"
            required
            maxLength={120}
            className={`field ${fieldErrors.client_name ? "border-ink" : ""}`}
          />
          <FieldError message={fieldErrors.client_name} />
        </Labelled>

        <Labelled label="Phone" span={6}>
          {/* The number the Share tab builds the WhatsApp link from, so a
              missing digit here is why a link never arrives. */}
          <input
            type="tel"
            value={form.client_phone}
            onChange={(event) => set("client_phone", event.target.value)}
            placeholder="+91 98470 12345"
            maxLength={20}
            className={`field ${fieldErrors.client_phone ? "border-ink" : ""}`}
          />
          <FieldError message={fieldErrors.client_phone} />
        </Labelled>

        <Labelled label="Email" span={6}>
          <input
            type="email"
            value={form.client_email}
            onChange={(event) => set("client_email", event.target.value)}
            placeholder="thomas@example.com"
            className={`field ${fieldErrors.client_email ? "border-ink" : ""}`}
          />
          <FieldError message={fieldErrors.client_email} />
        </Labelled>

        <Labelled label="Site address" span={6}>
          <input
            type="text"
            value={form.address}
            onChange={(event) => set("address", event.target.value)}
            placeholder="Plot 14, Kakkanad"
            className="field"
          />
        </Labelled>
      </FormGrid>

      {error ? (
        <p role="alert" className="mt-4 text-[0.875rem] text-ink">
          {error}
        </p>
      ) : null}

      <FormActions
        submitLabel="Save changes"
        busyLabel="Saving…"
        busy={busy}
        disabled={!form.name.trim() || !form.client_name.trim()}
        onCancel={onCancel}
      />
    </FormCard>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="mt-1 block text-[0.8125rem] text-ink">
      {message}
    </span>
  );
}
