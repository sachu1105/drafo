"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/marketing/AuthShell";
import { ApiError } from "@/lib/api";
import { register } from "@/lib/auth";

/**
 * Registration -- for whoever sends the drawings, and only them.
 *
 * Their clients never see this page and must never be sent here. A client
 * arrives on /p/<token> and is asked for nothing at all. That, not a list of
 * job titles, is the line this page has to draw.
 *
 * Four fields, and then they are in. Nothing waits for approval and nothing
 * waits for an email: an account that has just been made is empty, owns no
 * projects and can reach nothing but its own, so there is nothing to guard.
 * Everything else about them -- phone, location, logo, photo, the card -- is
 * on the profile screen, filled in by someone who has seen what it is for.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    practice_name: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The server signs them in as it creates the account, so there is no
      // second trip through the login form.
      await register(form);
      router.replace("/projects");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not create the account.",
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-display">Create an account</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
        For everyone who designs and builds. Your clients do not need an
        account — you send them a link.
      </p>

      <form onSubmit={submit} className="mt-10 space-y-6">
        {/* Your name first, then the studio's. Asking only for a "practice
            name" is how a one-person studio ends up with their own name in a
            box labelled practice, and then meets a settings page that never
            mentions them. */}
        <Field label="Your name" hint="The person your client is dealing with">
          <input
            type="text"
            value={form.full_name}
            onChange={set("full_name")}
            autoComplete="name"
            className="field"
          />
        </Field>

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
          {busy ? "Creating…" : "Create an account"}
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
