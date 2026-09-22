"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/marketing/AuthShell";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/auth";

/**
 * The architect's login. The client never reaches this page, and never will:
 * if a client is ever shown a login screen, the product is dead.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace("/projects");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not sign in.",
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-display">Sign in</h1>

      <form onSubmit={submit} className="mt-8">
        <label htmlFor="email" className="eyebrow block">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          className="field mt-2"
        />

        <label htmlFor="password" className="eyebrow mt-6 block">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="field mt-2"
        />

        {error ? (
          <p role="alert" className="mt-5 text-[0.875rem]">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn-primary mt-8 w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-[0.875rem] text-muted">
        New here?{" "}
        <Link href="/register" className="underline decoration-rule hover:text-ink">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
