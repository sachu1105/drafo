"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Architect } from "@/lib/types";

/**
 * The account menu.
 *
 * Just the mark and a chevron. The name is not repeated in the bar -- it is
 * already the wordmark on the left, and printing it twice made neither
 * instance read as the logo.
 *
 * Inside, the header names the person first and the practice second, because
 * that is the order the profile screen puts them in and the two are not the
 * same thing.
 */
export function UserMenu({
  architect,
  onSignOut,
}: {
  architect: Architect;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus(); // never strand the keyboard user
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex min-h-[44px] items-center gap-1.5 py-1 pl-1 pr-1.5
                   transition-colors duration-150 hover:bg-card"
      >
        <Avatar architect={architect} />
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 animate-rise
                     border border-rule bg-card shadow-menu"
        >
          <div className="border-b border-ruleSoft px-4 py-3">
            <p className="truncate text-[0.875rem]">{architect.display_name}</p>
            {architect.full_name &&
            architect.practice_name !== architect.full_name ? (
              <p className="truncate text-[0.8125rem] text-muted">
                {architect.practice_name}
              </p>
            ) : null}
            <p className="truncate text-[0.8125rem] text-faint">{architect.email}</p>
          </div>

          <div className="py-1">
            <MenuLink href="/projects" onSelect={() => setOpen(false)}>
              Projects
            </MenuLink>
            <MenuLink href="/profile" onSelect={() => setOpen(false)}>
              Your profile
            </MenuLink>
            {/* Staff only. A self-registered account has no business seeing a
                door it cannot open. */}
            {architect.is_staff ? (
              <a
                role="menuitem"
                href="/django-admin/"
                className="flex min-h-[44px] items-center px-4 text-[0.875rem]
                           text-muted transition-colors duration-150
                           hover:bg-paper hover:text-ink"
              >
                Admin console
              </a>
            ) : null}
          </div>

          <div className="border-t border-ruleSoft py-1">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex min-h-[44px] w-full items-center px-4 text-left
                         text-[0.875rem] text-muted transition-colors duration-150
                         hover:bg-paper hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onSelect,
  children,
}: {
  href: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onSelect}
      className="flex min-h-[44px] items-center px-4 text-[0.875rem] text-muted
                 transition-colors duration-150 hover:bg-paper hover:text-ink"
    >
      {children}
    </Link>
  );
}

/**
 * Their face if they have given one, otherwise the practice mark, otherwise
 * initials. The photo comes first: this is the account menu, and the logo is
 * already the wordmark two inches to the left.
 */
function Avatar({ architect }: { architect: Architect }) {
  const picture = architect.avatar_url ?? architect.logo_url;
  if (picture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={picture}
        alt=""
        className={`h-9 w-9 shrink-0 border border-rule ${
          architect.avatar_url ? "object-cover" : "object-contain"
        }`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand
                 text-[0.8125rem] font-medium tracking-wide text-paper"
    >
      {initials(architect)}
    </span>
  );
}

function initials(architect: Architect): string {
  const words = architect.display_name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return architect.email.slice(0, 1).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 text-faint transition-transform duration-150 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M2.5 4.5L6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
