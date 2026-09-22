"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { rememberName, rememberedName } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { Approval } from "@/lib/types";
import { Tick } from "@/components/Tick";

/**
 * The approval.
 *
 * This is the product. Everything else on the screen is supporting cast, so
 * this is the clearest element on it: full width, dark, unmissable.
 *
 * Once it has happened it becomes a quiet line of record -- a date and a name,
 * no celebration. The client is confirming a building decision, not winning
 * anything.
 */
export function ApprovePanel({
  token,
  versionId,
  approval: initial,
  revision,
}: {
  token: string;
  versionId: number;
  approval: Approval | null;
  revision: number;
}) {
  const [approval, setApproval] = useState<Approval | null>(initial);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (approval) {
    return (
      <div className="rule-top mt-10 animate-rise pt-5">
        <p className="eyebrow flex items-center gap-1.5 text-accent">
          <Tick />
          Approved
        </p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed">
          Revision {revision} was approved by {approval.approved_by_name} on{" "}
          {formatDateTime(approval.approved_at)}.
        </p>
        <p className="mt-1.5 text-[0.8125rem] text-faint">
          This record is kept with the drawing and cannot be changed.
        </p>
      </div>
    );
  }

  function begin() {
    // Asked once, on their first approval; remembered on their own device
    // afterwards, so the second drawing is genuinely one tap.
    setName(rememberedName());
    setError(null);
    setConfirming(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Please type your name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await api<Approval>(
        `/p/${token}/versions/${versionId}/approve/`,
        { method: "POST", body: { approved_by_name: trimmed } },
      );
      rememberName(trimmed);
      setApproval(created);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "That did not go through. Please try again.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="rule-top mt-10 pt-6">
      {!confirming ? (
        <>
          <button type="button" onClick={begin} className="btn-primary w-full">
            Approve this drawing
          </button>
          <p className="mt-3 text-center text-[0.8125rem] text-faint">
            Your name and the date and time are recorded.
          </p>
        </>
      ) : (
        <form onSubmit={submit} className="animate-rise">
          <label
            htmlFor="approver-name"
            className="block text-[0.9375rem] leading-relaxed"
          >
            Please type your name to approve revision {revision}.
          </label>
          <input
            id="approver-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            autoComplete="name"
            enterKeyHint="done"
            placeholder="Your name"
            className="field mt-3"
          />

          {error ? (
            <p role="alert" className="mt-3 text-[0.875rem] text-ink">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={saving} className="btn-primary mt-4 w-full">
            {saving ? "Recording approval…" : "Confirm approval"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="btn mt-1 w-full text-muted hover:text-ink"
          >
            Not yet
          </button>
        </form>
      )}
    </div>
  );
}
