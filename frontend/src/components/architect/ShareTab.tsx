"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

/**
 * How the link actually travels.
 *
 * Not email, not an "invite your client" flow with a signup at the end of it.
 * One tap to WhatsApp, with the message already written.
 *
 * This screen used to carry three paragraphs and a sidebar listing what the
 * client would see. All of it was written for somebody meeting the product
 * for the first time, and all of it was still there on the fortieth visit.
 * What is left is the link, the two things anyone does with it, and the way
 * out if it leaks.
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
    <div className="max-w-[46rem]">
      <h2 className="sr-only">Share</h2>

      {/* --- the link and the three things you do with it ---------------- */}
      <div className="border border-rule bg-card p-5 sm:p-6">
        <p className="eyebrow">Client link</p>

        <p
          className="mt-3 break-all border border-ruleSoft bg-paper px-4 py-3
                     font-mono text-[0.8125rem] leading-relaxed"
        >
          {project.client_url}
        </p>

        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <a
            href={whatsapp}
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
              href={project.client_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-quiet"
            >
              Preview
            </a>
          </div>
        </div>

        {/* Only when it is actually about to be a problem. */}
        {!project.client_phone ? (
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
            No phone number saved for {project.client_name}, so WhatsApp will
            ask you who to send it to.
          </p>
        ) : null}
      </div>

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
        Anyone holding this link can view the project and approve drawings.
        There is no password.
      </p>

      {/* --- the recovery path ------------------------------------------ */}
      <section className="mt-10 border-t border-rule pt-6">
        {confirmRotate ? (
          <div className="animate-rise border border-brand bg-card p-5">
            <p className="text-[0.9375rem] leading-relaxed">
              Replace the link for{" "}
              <strong className="font-medium">{project.name}</strong>? The
              current one stops working immediately, for {project.client_name}
              {" "}too, and this cannot be undone.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={rotate}
                disabled={rotating}
                className="btn-primary"
              >
                {rotating ? "Replacing…" : "Replace it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRotate(false)}
                disabled={rotating}
                className="btn-text px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className="text-[0.875rem] text-muted">
              Link leaked? Replace it with a new one.
            </p>
            <button
              type="button"
              onClick={() => setConfirmRotate(true)}
              className="btn-quiet shrink-0"
            >
              Replace link
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
