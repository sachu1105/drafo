"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/marketing/AuthShell";
import { ApiError } from "@/lib/api";
import { register } from "@/lib/auth";

/**
 * Registration -- for architects, engineers and designers only.
 *
 * Their clients never see this page and must never be sent here. A client
 * arrives on /p/<token> and is asked for nothing at all.
 *
 * Accounts arrive inactive and wait for a superuser to approve them, so this
 * form is a request for access rather than a door.
 */
export default function RegisterPage() {
  const [form, setForm] = useState({
    practice_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not create the account.",
      );
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthShell>
        <h1 className="font-display text-display">Request received</h1>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          Your account for <span className="text-ink">{form.practice_name}</span>{" "}
          has been created and is waiting for approval.
        </p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          You will be able to sign in as soon as it is activated. We will email{" "}
          {form.email} when that happens.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/" className="btn-primary">
            Back to the site
          </Link>
          <Link href="/login" className="btn-quiet">
            Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-display">Create an account</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
        For architects, engineers and designers. Your clients do not need an
        account — you send them a link.
      </p>

      <form onSubmit={submit} className="mt-10 space-y-6">
        <Field
          label="Practice name"
          hint="This appears at the top of every screen your client sees"
        >
          <input
            type="text"
            value={form.practice_name}
            onChange={set("practice_name")}
            required
            autoComplete="organization"
            className="field"
          />
        </Field>

        <Field label="Email" hint="You will sign in with this">
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            required
            autoComplete="username"
            className="field"
          />
        </Field>

        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            autoComplete="tel"
            className="field"
          />
        </Field>

        <Field label="Password" hint="At least 8 characters">
          <input
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={8}
            autoComplete="new-password"
            className="field"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-[0.875rem]">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating…" : "Request an account"}
        </button>
      </form>

      <p className="mt-6 text-[0.875rem] text-muted">
        Already have one?{" "}
        <Link href="/login" className="underline decoration-rule hover:text-ink">
          Sign in
        </Link>
      </p>
    </AuthShell>
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
      {hint ? (
        <span className="mt-1 block text-[0.8125rem] text-faint">{hint}</span>
      ) : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
