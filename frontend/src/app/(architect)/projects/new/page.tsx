"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    client_phone: "",
    client_email: "",
    address: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const project = await api<Project>("/projects/", {
        method: "POST",
        body: form,
      });
      router.replace(`/projects/${project.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not create the project.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-shell px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-[38rem]">
      <Link href="/projects" className="text-[0.875rem] text-muted hover:text-ink">
        &lsaquo; Projects
      </Link>
      <h1 className="mt-4 font-display text-title">New project</h1>

      <form
        onSubmit={submit}
        className="mt-6 space-y-6 border border-rule bg-card p-6 sm:p-8"
      >
        <Field label="Project name" hint="Thomas Residence, Kottayam">
          <input
            type="text"
            value={form.name}
            onChange={set("name")}
            required
            className="field"
          />
        </Field>

        <Field label="Client name">
          <input
            type="text"
            value={form.client_name}
            onChange={set("client_name")}
            required
            className="field"
          />
        </Field>

        <Field label="Client phone" hint="Used for the WhatsApp share">
          <input
            type="tel"
            value={form.client_phone}
            onChange={set("client_phone")}
            className="field"
          />
        </Field>

        <Field label="Client email" hint="Notified when you upload a drawing">
          <input
            type="email"
            value={form.client_email}
            onChange={set("client_email")}
            className="field"
          />
        </Field>

        <Field label="Site address">
          <textarea
            value={form.address}
            onChange={set("address")}
            rows={3}
            className="field"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-[0.875rem]">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating…" : "Create project"}
        </button>
      </form>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow block">{label}</span>
      {hint ? <span className="mt-1 block text-[0.8125rem] text-faint">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
