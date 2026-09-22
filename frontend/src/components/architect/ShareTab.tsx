"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

/**
 * How the link actually travels.
 *
 * Not email, not an "invite your client" flow with a signup at the end of it.
 * One tap to WhatsApp, with the message already written.
 */
export function ShareTab({
  project,
  onChange,
}: {
  project: Project;
  onChange: (project: Project) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const message =
    `${project.name}\n\n` +
    `Here is the link to your project page. You can see the drawings, ` +
    `approve them and leave notes. No app or login is needed.\n\n` +
    `${project.client_url}\n\n` +
    `Please keep the link to yourself.`;

  const digits = project.client_phone.replace(/\D/g, "");
  const whatsapp = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(project.client_url);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function rotate() {
    setRotating(true);
    try {
      onChange(
        await api<Project>(`/projects/${project.id}/rotate-token/`, {
          method: "POST",
        }),
      );
      setConfirmRotate(false);
    } finally {
      setRotating(false);
    }
  }

  return (
    <div>
      <h2 className="sr-only">Share</h2>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- the link and the two things you do with it ---------------- */}
        <div className="border border-rule bg-card p-5 sm:p-6 lg:col-span-2">
          <h3 className="eyebrow">Client link</h3>

          <p
            className="mt-3 break-all border border-ruleSoft bg-paper px-4 py-3
                       font-mono text-[0.8125rem] leading-relaxed"
          >
            {project.client_url}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex-1 sm:flex-none sm:px-7"
            >
              Share on WhatsApp
            </a>
            <button type="button" onClick={copy} className="btn-quiet flex-1 sm:flex-none">
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={project.client_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-quiet flex-1 sm:flex-none"
            >
              Preview as client
            </a>
          </div>

          {!project.client_phone ? (
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
              No phone number saved for {project.client_name}, so WhatsApp will
              ask you who to send it to.
            </p>
          ) : null}
        </div>

        {/* --- what they will actually experience ------------------------ */}
        <aside className="border border-rule bg-card p-5 sm:p-6">
          <h3 className="eyebrow">What {project.client_name} sees</h3>
          <ul className="mt-4 space-y-3 text-[0.875rem] leading-relaxed text-muted">
            <li>Your practice name and logo at the top — not ours.</li>
            <li>The current drawing, readable without pinch-zoom.</li>
            <li>One button to approve, and a box to leave a note.</li>
            <li>No account, no password, no app to install.</li>
          </ul>
        </aside>
      </div>

      <p className="mt-4 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted">
        Anyone holding this link can see the project and approve drawings.
        There is no password, and that is the point: your client opens it and
        it works.
      </p>

      {/* --- the recovery path ------------------------------------------ */}
      <section className="mt-10 border-t border-rule pt-6">
        <h3 className="eyebrow">If the link leaks</h3>
        <p className="mt-2 max-w-[70ch] text-[0.875rem] leading-relaxed text-muted">
          Rotating replaces it immediately. The old link stops working for
          everyone, including {project.client_name}, so you will need to send
          them the new one.
        </p>

        {confirmRotate ? (
          <div className="mt-4 animate-rise border border-brand bg-card p-5">
            <p className="text-[0.9375rem] leading-relaxed">
              Rotate the link for <strong className="font-medium">{project.name}</strong>?
              The current link stops working the moment you do, and this cannot
              be undone.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={rotate}
                disabled={rotating}
                className="btn-primary"
              >
                {rotating ? "Rotating…" : "Yes, rotate it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRotate(false)}
                className="btn-quiet"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRotate(true)}
            className="btn-quiet mt-4"
          >
            Rotate link
          </button>
        )}
      </section>
    </div>
  );
}
