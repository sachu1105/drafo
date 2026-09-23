"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProfileCard } from "@/components/ProfileCard";
import { ImagePicker } from "@/components/architect/ImagePicker";
import { TaxRateField } from "@/components/architect/TaxRateField";
import { ApiError } from "@/lib/api";
import { me, sendEmailVerification, updateProfile } from "@/lib/auth";
import type { Architect, ProfileCard as Card } from "@/lib/types";

/**
 * Your profile.
 *
 * This screen used to be called "Your practice" and held a name, a phone
 * number and a logo. That was honest about the letterhead and silent about
 * the person, so a one-person studio typed their own name into a box labelled
 * "practice name" and then met their own email address under a heading that
 * never mentioned them. The page now says out loud which of the two each
 * field belongs to:
 *
 *   You             the person the client is dealing with
 *   Your practice   the letterhead above every page the client opens
 *   Contact         how either of them is reached
 *   Your card       the one page in this product anyone may open
 *
 * The card preview is live and built from the same component the public page
 * renders, so nothing on it can be a surprise after saving.
 */

const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
const COVER_ACCEPT = "image/png,image/jpeg,image/webp";
const BIO_LIMIT = 600;

// Kept in step with MAX_LOGO_MB / MAX_AVATAR_MB / MAX_COVER_MB in
// portal/serializers.py, which remains the gate. These only buy the person an
// immediate answer instead of a failed save.
const MB = 1024 * 1024;
const AVATAR_MAX = 4 * MB;
const LOGO_MAX = 2 * MB;
const COVER_MAX = 6 * MB;

/**
 * A slug the server will actually accept.
 *
 * Applied when the field is left, not while it is being typed: someone
 * typing "anna-mathew" is briefly at "anna-", and snatching the hyphen away
 * mid-word makes the keyboard feel broken.
 */
function tidySlug(value: string): string {
  return value.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Put a DRF error body back against the fields it came from.
 *
 * `{"card_slug": ["That link is reserved."]}` belongs under the link box, not
 * in a line at the bottom of a form four panels long.
 */
function fieldErrorsFrom(data: unknown): Record<string, string> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key === "detail") continue;
    const message = Array.isArray(value) ? value[0] : value;
    if (typeof message === "string") out[key] = message;
  }
  return out;
}

type Draft = {
  full_name: string;
  profession: string;
  bio: string;
  practice_name: string;
  phone: string;
  location: string;
  website: string;
  card_slug: string;
  card_is_public: boolean;
  // --- billing: what gets stamped onto an invoice as it is raised ---
  gstin: string;
  billing_address: string;
  bank_details: string;
  default_tax_percent: string;
  invoice_terms: string;
};

function draftOf(architect: Architect): Draft {
  return {
    full_name: architect.full_name,
    profession: architect.profession,
    bio: architect.bio,
    practice_name: architect.practice_name,
    phone: architect.phone,
    location: architect.location,
    website: architect.website,
    card_slug: architect.card_slug ?? "",
    card_is_public: architect.card_is_public,
    gstin: architect.gstin,
    billing_address: architect.billing_address,
    bank_details: architect.bank_details,
    // The API sends "18.00" and the box should not say that back.
    default_tax_percent: architect.default_tax_percent
      ? String(Number(architect.default_tax_percent))
      : "",
    invoice_terms: architect.invoice_terms,
  };
}

export default function ProfilePage() {
  const [architect, setArchitect] = useState<Architect | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [dropAvatar, setDropAvatar] = useState(false);
  const [dropLogo, setDropLogo] = useState(false);
  const [dropCover, setDropCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [verify, setVerify] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle",
  );
  const [verifyNote, setVerifyNote] = useState("");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    me()
      .then((current) => {
        setArchitect(current);
        setDraft(draftOf(current));
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  async function askForVerification() {
    setVerify("sending");
    try {
      const result = await sendEmailVerification();
      setVerify("sent");
      setVerifyNote(result.detail);
    } catch (caught) {
      setVerify("failed");
      setVerifyNote(
        caught instanceof ApiError
          ? caught.message
          : "Could not send it. Try again in a minute.",
      );
    }
  }

  const dirty = useMemo(() => {
    if (!architect || !draft) return false;
    const original = draftOf(architect);
    const changed = (Object.keys(original) as (keyof Draft)[]).some(
      (key) => original[key] !== draft[key],
    );
    return (
      changed ||
      Boolean(
        avatarFile ||
          logoFile ||
          coverFile ||
          dropAvatar ||
          dropLogo ||
          dropCover,
      )
    );
  }, [
    architect,
    draft,
    avatarFile,
    logoFile,
    coverFile,
    dropAvatar,
    dropLogo,
    dropCover,
  ]);

  // Previews of unsaved files, so the card on the right is always the card
  // that is about to exist.
  const avatarPreview = useObjectUrl(avatarFile);
  const logoPreview = useObjectUrl(logoFile);
  const coverPreview = useObjectUrl(coverFile);

  const preview: Card | null =
    architect && draft
      ? {
          name: draft.full_name.trim() || draft.practice_name.trim() || "Your name",
          profession: draft.profession.trim(),
          practice_name: draft.practice_name.trim(),
          bio: draft.bio.trim(),
          phone: draft.phone.trim(),
          email: architect.email,
          location: draft.location.trim(),
          website: draft.website.trim(),
          avatar_url:
            avatarPreview ?? (dropAvatar ? null : architect.avatar_url),
          logo_url: logoPreview ?? (dropLogo ? null : architect.logo_url),
          cover_url: coverPreview ?? (dropCover ? null : architect.cover_url),
          card_slug: draft.card_slug,
        }
      : null;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;

    const payload = new FormData();
    payload.append("full_name", draft.full_name.trim());
    payload.append("profession", draft.profession.trim());
    payload.append("bio", draft.bio.trim());
    payload.append("practice_name", draft.practice_name.trim());
    payload.append("phone", draft.phone.trim());
    payload.append("location", draft.location.trim());
    payload.append("website", draft.website.trim());
    payload.append("card_slug", tidySlug(draft.card_slug.trim().toLowerCase()));
    payload.append("card_is_public", String(draft.card_is_public));
    payload.append("gstin", draft.gstin.trim());
    payload.append("billing_address", draft.billing_address.trim());
    payload.append("bank_details", draft.bank_details.trim());
    // Empty means the practice charges none. The serializer reads "" as null.
    payload.append("default_tax_percent", draft.default_tax_percent.trim());
    payload.append("invoice_terms", draft.invoice_terms.trim());
    if (avatarFile) payload.append("avatar", avatarFile);
    else if (dropAvatar) payload.append("remove_avatar", "true");
    if (logoFile) payload.append("logo", logoFile);
    else if (dropLogo) payload.append("remove_logo", "true");
    if (coverFile) payload.append("cover", coverFile);
    else if (dropCover) payload.append("remove_cover", "true");

    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const updated = await updateProfile(payload);
      setArchitect(updated);
      setDraft(draftOf(updated));
      setAvatarFile(null);
      setLogoFile(null);
      setCoverFile(null);
      setDropAvatar(false);
      setDropLogo(false);
      setDropCover(false);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        setError("Could not save.");
        return;
      }
      const perField = fieldErrorsFrom(caught.data);
      setFieldErrors(perField);
      const first = Object.keys(perField)[0];
      if (first) {
        // Say it once, next to the thing that is wrong, and go there.
        document
          .querySelector(`[data-field="${first}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setError(caught.message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!architect || !draft || !preview) {
    return (
      <main className="mx-auto max-w-shell px-4 py-10 sm:px-8">
        <p className="text-[0.875rem] text-faint">
          {loadFailed ? "Could not load your account." : "Loading…"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-shell px-4 py-10 sm:px-8">
      <Link href="/projects" className="text-[0.875rem] text-muted hover:text-ink">
        &lsaquo; Projects
      </Link>
      <h1 className="mt-4 font-display text-display">Your profile</h1>
      <p className="mt-2 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted">
        Everything here goes on the card you can send to anyone. It updates as
        you type.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,38rem)_minmax(0,1fr)] lg:gap-12">
        {/* ============================ the form ======================== */}
        <form onSubmit={submit} className="min-w-0 space-y-6 lg:order-first">
          {/* --- you -----------------------------------------------------
              Contact used to be a panel of its own. It is the same person's
              phone number, so it is the same panel, with a rule across it. */}
          <Panel
            title="You"
            note="The person your client is dealing with."
          >
            <ImagePicker
              label="Photo"
              hint="PNG, JPG or WEBP, up to 4 MB. Shown as a square, so a square picture crops best."
              currentUrl={architect.avatar_url}
              file={avatarFile}
              removed={dropAvatar}
              onFile={(file) => {
                setAvatarFile(file);
                if (file) setDropAvatar(false);
              }}
              onRemove={() => {
                setAvatarFile(null);
                setDropAvatar(true);
              }}
              accept={AVATAR_ACCEPT}
              maxBytes={AVATAR_MAX}
              error={fieldErrors.avatar}
            />

            <Field
              label="Your name"
              value={draft.full_name}
              error={fieldErrors.full_name}
              name="full_name"
              onChange={(value) => set("full_name", value)}
              placeholder="Sachu Kumar"
              autoComplete="name"
              maxLength={120}
            />

            <Field
              label="Profession"
              value={draft.profession}
              error={fieldErrors.profession}
              name="profession"
              onChange={(value) => set("profession", value)}
              placeholder="Principal Architect"
              autoComplete="organization-title"
              maxLength={120}
            />

            <label className="block">
              <span className="eyebrow block">About</span>
              <textarea
                value={draft.bio}
                onChange={(event) =>
                  set("bio", event.target.value.slice(0, BIO_LIMIT))
                }
                rows={3}
                maxLength={BIO_LIMIT}
                placeholder="A few lines on what you do and who you do it for."
                className="field mt-2"
              />
              <span className="mt-1 flex items-baseline justify-between gap-4">
                <span className="text-[0.8125rem] text-ink">
                  {fieldErrors.bio ?? ""}
                </span>
                <span className="shrink-0 text-[0.75rem] text-faint">
                  {draft.bio.length} / {BIO_LIMIT}
                </span>
              </span>
            </label>

            <div className="grid gap-6 rule-top pt-6 sm:grid-cols-2">
              <Field
                label="Phone"
                value={draft.phone}
                error={fieldErrors.phone}
                name="phone"
                onChange={(value) => set("phone", value)}
                placeholder="+91 70267 00024"
                type="tel"
                autoComplete="tel"
                maxLength={20}
              />

              <Field
                label="Location"
                value={draft.location}
                error={fieldErrors.location}
                name="location"
                onChange={(value) => set("location", value)}
                placeholder="Kochi, Kerala"
                maxLength={120}
              />

              <Field
                label="Website"
                value={draft.website}
                error={fieldErrors.website}
                name="website"
                onChange={(value) => set("website", value)}
                placeholder="https://your-studio.in"
                type="url"
                autoComplete="url"
                maxLength={200}
              />

              {/* Email is the sign-in and is not editable, so it is read
                  out rather than offered as a field. Confirming it is the
                  one thing that can be done to it here: nothing in the
                  product is gated on the answer, but every notification we
                  send goes to this address, and an address with a typo in
                  it fails silently forever. */}
              <div>
                <span className="eyebrow block">Email</span>
                <p className="mt-2 text-[0.9375rem]">{architect.email}</p>
                {architect.email_verified ? (
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-faint">
                    Confirmed. Your sign-in, and not editable here.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-faint">
                      Your sign-in. Not confirmed yet — confirm it so you do
                      not miss a client approval.
                    </p>
                    {/* type="button": this sits inside the profile form and
                        must never save it. */}
                    <button
                      type="button"
                      onClick={askForVerification}
                      disabled={verify === "sending" || verify === "sent"}
                      className="btn-quiet mt-3"
                    >
                      {verify === "sending"
                        ? "Sending…"
                        : verify === "sent"
                          ? "Link sent"
                          : "Send confirmation link"}
                    </button>
                    {verifyNote ? (
                      <p
                        role="status"
                        className="mt-2 text-[0.8125rem] leading-relaxed text-muted"
                      >
                        {verifyNote}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </Panel>

          {/* --- the practice --------------------------------------------
              Folded shut, because for a one-person studio it is two fields
              that never change after the first day. The summary says in
              words what the panel is for, which is the question it kept
              being asked. */}
          <FoldPanel
            title="Your practice"
            summary={
              architect.logo_url && !dropLogo
                ? "Your logo sits at the top of every page you share with a client, and on your card."
                : `Your clients see “${draft.practice_name || "—"}” at the top of every page you share with them, and on your card.`
            }
            /* An error inside a shut panel is an error nobody can read. */
            forceOpen={Boolean(fieldErrors.practice_name || fieldErrors.logo)}
          >
            <Field
              label="Practice name"
              hint="The studio, not you — unless they are the same thing."
              value={draft.practice_name}
              error={fieldErrors.practice_name}
              name="practice_name"
              onChange={(value) => set("practice_name", value)}
              placeholder="Kumar & Associates"
              autoComplete="organization"
              required
              maxLength={120}
            />

            <ImagePicker
              label="Logo"
              hint="Your mark, shown small and on its own — not a photograph. PNG, JPG, WEBP or SVG, up to 2 MB. For the picture across the top of your card, use the cover image under Your card."
              currentUrl={architect.logo_url}
              file={logoFile}
              removed={dropLogo}
              onFile={(file) => {
                setLogoFile(file);
                if (file) setDropLogo(false);
              }}
              onRemove={() => {
                setLogoFile(null);
                setDropLogo(true);
              }}
              accept={LOGO_ACCEPT}
              shape="wide"
              maxBytes={LOGO_MAX}
              error={fieldErrors.logo}
            />
          </FoldPanel>

          {/* --- billing -------------------------------------------------
              Folded shut like the practice panel, and for the same reason:
              it is filled in once and then never looked at again. It is here
              rather than on the invoice form because these answers are the
              same on every invoice, and a field that is retyped every time is
              a field that eventually disagrees with itself -- on a document
              that is a tax record. */}
          <FoldPanel
            title="Billing"
            summary={
              draft.gstin
                ? `Invoices go out under ${draft.practice_name || "your practice"}, GSTIN ${draft.gstin}.`
                : "Your GST number, billing address and bank details, for the top and bottom of an invoice."
            }
            forceOpen={Boolean(fieldErrors.gstin || fieldErrors.default_tax_percent)}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label="GSTIN"
                hint="Left blank if you are not registered."
                value={draft.gstin}
                error={fieldErrors.gstin}
                name="gstin"
                onChange={(value) => set("gstin", value.toUpperCase())}
                placeholder="32AAAAA0000A1Z5"
                maxLength={20}
              />

              {/* Chosen, not typed. The rates are already in the database,
                  and a mistyped rate is wrong arithmetic on a document
                  somebody files for their accountant. */}
              <label className="flex h-full flex-col" data-field="default_tax_percent">
                <span className="eyebrow block">Default tax rate</span>
                <span className="mt-1 block text-[0.8125rem] text-faint">
                  What a new invoice line starts at.
                </span>
                <span className="mt-auto block">
                  <TaxRateField
                    value={draft.default_tax_percent}
                    onChange={(percent) => set("default_tax_percent", percent)}
                    noneLabel="No tax"
                  />
                </span>
                {fieldErrors.default_tax_percent ? (
                  <span role="alert" className="mt-1 block text-[0.8125rem] text-ink">
                    {fieldErrors.default_tax_percent}
                  </span>
                ) : null}
              </label>
            </div>

            <label className="block">
              <span className="eyebrow block">Billing address</span>
              <span className="mt-1 block text-[0.8125rem] text-faint">
                Your registered address, which is often not the studio people
                visit.
              </span>
              <textarea
                value={draft.billing_address}
                onChange={(event) => set("billing_address", event.target.value)}
                rows={3}
                placeholder={"12 Marine Drive\nKochi, Kerala 682031"}
                className="field mt-2"
              />
            </label>

            <label className="block">
              <span className="eyebrow block">Payment information</span>
              <span className="mt-1 block text-[0.8125rem] text-faint">
                Printed at the foot of every invoice. Whatever shape your bank
                uses.
              </span>
              <textarea
                value={draft.bank_details}
                onChange={(event) => set("bank_details", event.target.value)}
                rows={3}
                placeholder={
                  "Bank: HDFC Bank, Ernakulam\nA/c: 0123 4567 8901\nIFSC: HDFC0000123"
                }
                className="field mt-2"
              />
            </label>

            <label className="block">
              <span className="eyebrow block">Terms</span>
              <span className="mt-1 block text-[0.8125rem] text-faint">
                Copied onto each new invoice, where it can still be changed.
              </span>
              <textarea
                value={draft.invoice_terms}
                onChange={(event) => set("invoice_terms", event.target.value)}
                rows={2}
                placeholder="Payable within 14 days."
                className="field mt-2"
              />
            </label>
          </FoldPanel>

          {/* --- the card ----------------------------------------------- */}
          <CardPanel
            draft={draft}
            architect={architect}
            slugError={fieldErrors.card_slug}
            onSlug={(value) => set("card_slug", value)}
            onPublic={(value) => set("card_is_public", value)}
          >
            <ImagePicker
              label="Cover image"
              hint="The band across the top of your card. PNG, JPG or WEBP, up to 6 MB. It is cropped to a wide strip, so put nothing important near the top or bottom edge."
              currentUrl={architect.cover_url}
              file={coverFile}
              removed={dropCover}
              onFile={(file) => {
                setCoverFile(file);
                if (file) setDropCover(false);
              }}
              onRemove={() => {
                setCoverFile(null);
                setDropCover(true);
              }}
              accept={COVER_ACCEPT}
              shape="banner"
              maxBytes={COVER_MAX}
              error={fieldErrors.cover}
            />
          </CardPanel>

          {error ? (
            <p role="alert" className="text-[0.875rem] text-ink">
              {error}
            </p>
          ) : null}

          {/* The save bar exists only when it has something to do.
              Parked at the foot of the form it was a slab with a greyed-out
              button in it: chrome that is present all the time and useful
              almost none of it. Now nothing is there until something has been
              changed, and when it appears it is shaped like the panels above
              it rather than like a toolbar bolted to the window. */}
          {dirty || saving ? (
            <div
              className="sticky bottom-4 z-20 flex animate-rise flex-wrap items-center
                         justify-between gap-4 border border-rule bg-card px-5 py-4
                         shadow-menu"
            >
              <span className="text-[0.875rem] text-muted">
                {saving ? "Saving…" : "You have unsaved changes"}
              </span>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          ) : saved ? (
            <p className="animate-rise text-[0.875rem] text-accent">Saved</p>
          ) : null}
        </form>

        {/* ========================== the preview ======================= */}
        <aside className="order-first min-w-0 lg:sticky lg:top-24 lg:order-none lg:self-start">
          <h2 className="eyebrow">Your card</h2>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            {draft.card_is_public
              ? "This is exactly what opens at your link."
              : "This is what would open at your link. Switch the card on below to publish it."}
          </p>
          <div className="mt-4 max-w-[26rem]">
            <ProfileCard card={preview} interactive={false} />
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * A panel that stays shut until it is wanted.
 *
 * Its summary is a sentence about what the thing does, not a label -- the
 * whole reason this panel is folded is that "Your practice" on its own is a
 * heading people have to open to understand.
 */
function FoldPanel({
  title,
  summary,
  forceOpen,
  children,
}: {
  title: string;
  summary: string;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = open || Boolean(forceOpen);

  return (
    <section className="border border-rule bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
        <div className="min-w-0">
          <h2 className="font-display text-title">{title}</h2>
          <p className="mt-1.5 max-w-[48ch] text-[0.875rem] leading-relaxed text-muted">
            {summary}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={shown}
          className="btn-quiet shrink-0 px-4"
        >
          {shown ? "Done" : "Change"}
        </button>
      </div>

      {shown ? (
        <div className="space-y-6 border-t border-ruleSoft p-6 sm:p-8">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-rule bg-card p-6 sm:p-8">
      <h2 className="font-display text-title">{title}</h2>
      <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed text-muted">
        {note}
      </p>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  value,
  error,
  name,
  onChange,
  ...input
}: {
  label: string;
  hint?: string;
  value: string;
  /** The server's complaint about this one field, if it made one. */
  error?: string;
  name?: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    /* A column with the box pushed to the bottom of it.
     *
     * Two of these side by side in a grid used to sit at different heights
     * whenever their hints wrapped to a different number of lines -- a
     * one-line hint next to a two-line one put the boxes twenty pixels out.
     * Trimming the wording to match would fix it until somebody edited the
     * wording. `mt-auto` fixes it for good: the label sits at the top of its
     * cell, the box at the bottom, and a row of them lines up whatever the
     * hints do. */
    <label className="flex h-full flex-col" data-field={name}>
      <span className="eyebrow block">{label}</span>
      {hint ? (
        <span className="mt-1 block text-[0.8125rem] text-faint">{hint}</span>
      ) : null}
      <input
        {...input}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`field mt-auto ${error ? "border-ink" : ""}`}
      />
      {error ? (
        <span role="alert" className="mt-1 block text-[0.8125rem] text-ink">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/**
 * The card's own controls.
 *
 * Off by default and stated plainly: everything else in this product is
 * reachable only by an unguessable link, so a page anyone can open should
 * never happen by accident.
 */
function CardPanel({
  draft,
  architect,
  slugError,
  onSlug,
  onPublic,
  children,
}: {
  draft: Draft;
  architect: Architect;
  slugError?: string;
  onSlug: (value: string) => void;
  onPublic: (value: boolean) => void;
  /** The cover picker. It belongs to the card and to nothing else. */
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  // Built from the saved slug, not the draft: the link in the box has to be
  // one that actually resolves.
  const savedUrl = architect.card_url;
  const slugChanged = draft.card_slug !== (architect.card_slug ?? "");
  const live = architect.card_is_public && savedUrl && !slugChanged;

  const origin =
    savedUrl?.replace(/\/c\/[^/]*$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const draftUrl = `${origin}/c/${draft.card_slug}`;

  async function copy() {
    if (!savedUrl) return;
    try {
      await navigator.clipboard.writeText(savedUrl);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const message =
    `${draft.full_name.trim() || draft.practice_name.trim()}\n` +
    `${draft.profession.trim()}\n\n` +
    `${savedUrl ?? ""}`;

  return (
    <section className="border border-rule bg-card p-6 sm:p-8">
      <h2 className="font-display text-title">Your card</h2>
      <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed text-muted">
        One link with your photo, your details and a button that drops you
        straight into someone&rsquo;s contacts. Send it to anyone.
      </p>

      <div className="mt-6 space-y-6">
        {children}

        {/* --- the switch --------------------------------------------- */}
        {/* The explanation sits outside the label and is pointed at with
            aria-describedby. Inside it, the accessible name of the checkbox
            becomes the whole paragraph, and a screen reader reads three
            sentences before saying whether the box is ticked. */}
        <div className="border border-ruleSoft bg-paper p-4">
          <div className="flex items-start gap-3">
            <input
              id="card-public"
              type="checkbox"
              checked={draft.card_is_public}
              onChange={(event) => onPublic(event.target.checked)}
              aria-describedby="card-public-note"
              className="mt-1 h-4 w-4 shrink-0 accent-brand"
            />
            <label
              htmlFor="card-public"
              className="cursor-pointer text-[0.9375rem]"
            >
              Publish my card
            </label>
          </div>
          <p
            id="card-public-note"
            className="mt-2 pl-7 text-[0.8125rem] leading-relaxed text-muted"
          >
            While this is on, anyone with the link can open your card and see
            your name, photo, practice, phone, email, location and website.
            Your projects and drawings are never on it.
          </p>
        </div>

        {/* --- the link ------------------------------------------------- */}
        <div>
          <span className="eyebrow block">Your link</span>
          <span className="mt-1 block text-[0.8125rem] leading-relaxed text-faint">
            Changing this breaks every card you have already handed out.
          </span>
          <div
            data-field="card_slug"
            className={`mt-2 flex items-stretch border bg-card focus-within:border-brand ${
              slugError ? "border-ink" : "border-rule"
            }`}
          >
            <span
              className="hidden shrink-0 items-center border-r border-ruleSoft
                         bg-paper px-3 font-mono text-[0.8125rem] text-faint sm:flex"
            >
              {origin.replace(/^https?:\/\//, "")}/c/
            </span>
            <input
              type="text"
              value={draft.card_slug}
              onChange={(event) =>
                onSlug(
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-{2,}/g, "-")
                    .slice(0, 40),
                )
              }
              onBlur={(event) => onSlug(tidySlug(event.target.value))}
              spellCheck={false}
              aria-label="The last part of your card link"
              aria-invalid={Boolean(slugError)}
              className="min-w-0 flex-1 bg-transparent px-3.5 py-3 font-mono
                         text-[0.875rem] text-ink focus:outline-none"
            />
          </div>
          {slugError ? (
            <p role="alert" className="mt-2 text-[0.8125rem] text-ink">
              {slugError}
            </p>
          ) : (
            <p className="mt-2 break-all font-mono text-[0.8125rem] text-muted">
              {draftUrl}
            </p>
          )}
        </div>

        {/* --- what to do with it --------------------------------------- */}
        {live ? (
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary sm:px-7"
            >
              Share on WhatsApp
            </a>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" onClick={copy} className="btn-quiet">
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={savedUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-quiet"
              >
                Open it
              </a>
            </div>
          </div>
        ) : (
          <p className="text-[0.875rem] leading-relaxed text-muted">
            {slugChanged || !architect.card_is_public
              ? "Save your changes and the sharing buttons appear here."
              : "Switch the card on to share it."}
          </p>
        )}
      </div>
    </section>
  );
}

/** A revocable preview URL for a file that has not been uploaded yet. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [file]);
  return url;
}
