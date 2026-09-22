"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { me, updateProfile } from "@/lib/auth";
import type { Architect } from "@/lib/types";

/**
 * The practice's own details.
 *
 * Not a public profile and not a directory entry -- there is no discovery
 * anywhere in this product. This is the letterhead: the name and mark that sit
 * above every drawing the client opens.
 */
export default function ProfilePage() {
  const [architect, setArchitect] = useState<Architect | null>(null);
  const [practiceName, setPracticeName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    me()
      .then((current) => {
        setArchitect(current);
        setPracticeName(current.practice_name);
        setPhone(current.phone);
      })
      .catch(() => setError("Could not load your account."));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = new FormData();
    payload.append("practice_name", practiceName.trim());
    payload.append("phone", phone.trim());
    const logo = logoInput.current?.files?.[0];
    if (logo) payload.append("logo", logo);

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProfile(payload);
      setArchitect(updated);
      if (logoInput.current) logoInput.current.value = "";
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!architect) {
    return (
      <main className="mx-auto max-w-shell px-4 py-10 sm:px-8">
        <p className="mx-auto max-w-[38rem] text-[0.875rem] text-faint">
          {error ?? "Loading…"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-shell px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-[38rem]">
      <Link href="/projects" className="text-[0.875rem] text-muted hover:text-ink">
        &lsaquo; Projects
      </Link>
      <h1 className="mt-4 font-display text-title">Your practice</h1>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
        This is what your clients see at the top of every page you share with
        them.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-6 border border-rule bg-card p-6 sm:p-8"
      >
        <label className="block">
          <span className="eyebrow block">Practice name</span>
          <input
            type="text"
            value={practiceName}
            onChange={(event) => setPracticeName(event.target.value)}
            required
            className="field mt-2"
          />
        </label>

        <label className="block">
          <span className="eyebrow block">Phone</span>
          <span className="mt-1 block text-[0.8125rem] text-faint">
            Shown to your client so they can reach you
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="field mt-2"
          />
        </label>

        <div>
          <span className="eyebrow block">Logo</span>
          <span className="mt-1 block text-[0.8125rem] text-faint">
            PNG, JPG, WEBP or SVG, up to 2 MB. Replaces your practice name in
            the header.
          </span>

          {architect.logo_url ? (
            <div className="mt-3 border border-rule bg-card px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={architect.logo_url}
                alt="Current logo"
                className="max-h-12 w-auto max-w-[220px] object-contain object-left"
              />
            </div>
          ) : (
            <p className="mt-3 text-[0.8125rem] text-faint">
              No logo yet — your practice name is shown as text.
            </p>
          )}

          <input
            ref={logoInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="mt-3 block w-full text-[0.875rem] file:mr-3 file:border
                       file:border-rule file:bg-paper file:px-3 file:py-2
                       file:text-[0.875rem] file:text-ink"
          />
        </div>

        <div className="rule-top pt-5">
          <span className="eyebrow block">Email</span>
          <p className="mt-2 text-[0.9375rem]">{architect.email}</p>
          <p className="mt-1 text-[0.8125rem] text-faint">
            This is your sign-in and cannot be changed here.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-[0.875rem]">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
          {saved ? (
            <span className="animate-rise text-[0.875rem] text-accent">Saved</span>
          ) : null}
        </div>
      </form>
      </div>
    </main>
  );
}
