"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { rememberName, rememberedName } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { Comment } from "@/lib/types";

/**
 * Plain text against a revision. Deliberately not pins on a drawing: a note
 * that says "the kitchen window" is worth more than a dot at coordinates
 * nobody can find again on a phone.
 */
export function CommentThread({
  versionId,
  initial,
  mode,
  token,
}: {
  versionId: number;
  initial: Comment[];
  mode: "client" | "architect";
  token?: string;
}) {
  const [comments, setComments] = useState<Comment[]>(initial);
  const [name, setName] = useState(() =>
    mode === "client" ? rememberedName() : "",
  );
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedBody = body.trim();
    const trimmedName = name.trim();
    if (!trimmedBody) return;
    if (mode === "client" && trimmedName.length < 2) {
      setError("Please add your name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created =
        mode === "client"
          ? await api<Comment>(`/p/${token}/versions/${versionId}/comments/`, {
              method: "POST",
              body: { author_name: trimmedName, body: trimmedBody },
            })
          : await api<Comment>(`/drawing-versions/${versionId}/comments/`, {
              method: "POST",
              body: { body: trimmedBody },
            });
      if (mode === "client") rememberName(trimmedName);
      setComments((current) => [...current, created]);
      setBody("");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "That did not send.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rule-top mt-10 pt-5">
      <h2 className="eyebrow">Notes</h2>

      {comments.length > 0 ? (
        <ol className="mt-4 space-y-5">
          {comments.map((comment) => (
            <li key={comment.id} className="animate-rise">
              <p className="text-[0.8125rem] text-muted">
                {comment.author_name}
                <span className="text-faint"> · </span>
                {formatDateTime(comment.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[0.9375rem] leading-relaxed">
                {comment.body}
              </p>
            </li>
          ))}
        </ol>
      ) : null}

      <form onSubmit={submit} className="mt-6">
        {mode === "client" ? (
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="field mb-2"
          />
        ) : null}

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder={
            mode === "client"
              ? "Anything you want to ask or change?"
              : "Add a note for the client"
          }
          className="field resize-y"
        />

        {error ? (
          <p role="alert" className="mt-2 text-[0.875rem] text-ink">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="btn-quiet mt-2"
        >
          {saving ? "Sending…" : "Send note"}
        </button>
      </form>
    </section>
  );
}
