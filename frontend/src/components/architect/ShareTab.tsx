"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, RotateCcw } from "lucide-react";
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
 *
 * The layout is two panels of similar weight rather than one card with a
 * sentence and a button drifting underneath it. The card used to stop short
 * of the tab rule above it, which left a ragged right edge and a screen of
 * empty page below -- a tab with one small box in the corner of it reads as
 * unfinished, whatever is in the box.
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused, usually an insecure origin. Select it instead, so the
      // architect can copy it by hand rather than press a dead button.
      const node = document.getElementById("client-link-text");
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
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

  // The origin is the same on every project and nobody reads it. Dimming it
  // leaves the part that differs -- and the part worth checking against what
  // was pasted into WhatsApp -- as the only thing in full ink.
  const [origin, token] = splitLink(project.client_url);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <h2 className="sr-only">Share</h2>

      {/* --- the link and the two things you do with it ------------------ */}
      <div className="border border-rule bg-card p-5 sm:p-6">
        <p className="eyebrow">Client link</p>

        {/* The box is the button. It is the largest thing on the screen and
            it used to be the only one that did nothing when pressed. */}
        <button
          type="button"
          onClick={copy}
          aria-label="Copy the client link"
          className="group mt-3 flex w-full items-center gap-3 border border-ruleSoft
                     bg-paper px-4 py-3 text-left transition-colors duration-150
                     hover:border-brand"
        >
          <span
            id="client-link-text"
            className="min-w-0 flex-1 break-all font-mono text-[0.8125rem] leading-relaxed"
          >
            <span className="text-faint">{origin}</span>
            <span>{token}</span>
          </span>
          <span
            className={`shrink-0 transition-colors duration-150 ${
              copied ? "text-accent" : "text-faint group-hover:text-ink"
            }`}
          >
            {copied ? (
              <Check aria-hidden size={16} strokeWidth={2} />
            ) : (
              <Copy aria-hidden size={16} strokeWidth={1.75} />
            )}
          </span>
        </button>

        <p
          aria-live="polite"
          className="mt-1.5 h-4 text-[0.75rem] text-accent"
        >
          {copied ? "Copied" : ""}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary sm:px-7"
          >
            Share on WhatsApp
          </a>
          <a
            href={project.client_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-quiet"
          >
            <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
            Preview
          </a>
        </div>

        {/* Only when it is actually about to be a problem. */}
        {!project.client_phone ? (
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
            No phone number saved for {project.client_name}, so WhatsApp will
            ask you who to send it to.
          </p>
        ) : null}
      </div>

      {/* --- what the link is, and what to do when it goes wrong ---------
          A column rather than two lines trailing under the card. Both of
          these are facts about the link, so they belong beside it. */}
      <div className="space-y-px bg-rule">
        <Note
          icon={KeyRound}
          title="The link is the password"
          body={`Anyone holding it can see the drawings and approve them, as ${project.client_name} can. There is nothing else to get past, which is the point — and the reason to send it to one person.`}
        />

        {confirmRotate ? (
          <div className="animate-rise bg-card p-5">
            <p className="text-[0.9375rem] leading-relaxed">
              Replace the link for{" "}
              <strong className="font-medium">{project.name}</strong>? The
              current one stops working immediately, for {project.client_name}{" "}
              too, and this cannot be undone.
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
          <div className="bg-card p-5">
            <p className="flex items-center gap-2.5 text-[0.9375rem]">
              <RotateCcw
                aria-hidden
                size={16}
                strokeWidth={1.75}
                className="shrink-0 text-faint"
              />
              If it leaks
            </p>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
              A new link can be issued at any time. The old one stops working
              the moment it is.
            </p>
            {/* Not a btn-quiet: this breaks something that is working, and a
                destructive action that looks exactly like Copy and Preview is
                one mis-aimed click from an architect ringing to ask why their
                client cannot open the page. */}
            <button
              type="button"
              onClick={() => setConfirmRotate(true)}
              className="btn mt-4 min-h-[38px] border border-rule py-1.5 text-[0.875rem]
                         text-muted hover:border-ink hover:text-ink"
            >
              Replace link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Note({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof KeyRound;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-card p-5">
      <p className="flex items-center gap-2.5 text-[0.9375rem]">
        <Icon aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-brand" />
        {title}
      </p>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

/**
 * The origin and the token, apart.
 *
 * Falls back to the whole string rather than throwing: this is cosmetic, and
 * a URL shape nobody anticipated should cost the dimming, not the link.
 */
function splitLink(url: string): [string, string] {
  const at = url.lastIndexOf("/");
  if (at === -1) return ["", url];
  return [url.slice(0, at + 1), url.slice(at + 1)];
}
