"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { me } from "@/lib/auth";

const LINKS = [
  { href: "#problem", label: "Why" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#client", label: "For your client" },
];

/**
 * The public bar.
 *
 * If there is already a session, the two auth buttons collapse into one that
 * goes straight to work -- somebody who is signed in has no use for "Sign in".
 */
export function MarketingNav() {
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Signed out is the common case for this page, so the anonymous buttons
    // render first and we swap only on a confirmed session. No layout shift,
    // no empty gap while we wait.
    me()
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false));
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-6 px-4 py-3 sm:px-8">
        <Link
          href="/"
          className="flex min-h-[44px] shrink-0 items-center font-display
                     text-[1.375rem] leading-none tracking-tight"
        >
          Atelier
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.875rem] text-muted transition-colors duration-150
                         hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {signedIn ? (
            <Link href="/projects" className="btn-primary px-4 py-2">
              Go to your projects
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-text px-3 no-underline">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary px-4 py-2">
                Request an account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-label="Menu"
          className="-mr-2 flex h-11 w-11 items-center justify-center md:hidden"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5">
            {menuOpen ? (
              <path
                d="M5 5l10 10M15 5L5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 6h14M3 10h14M3 14h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div className="animate-rise border-t border-ruleSoft bg-paper md:hidden">
          <div className="mx-auto max-w-shell px-4 py-2 sm:px-8">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[48px] items-center border-b border-ruleSoft
                           text-[0.9375rem] text-muted"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 py-4">
              {signedIn ? (
                <Link href="/projects" className="btn-primary">
                  Go to your projects
                </Link>
              ) : (
                <>
                  <Link href="/register" className="btn-primary">
                    Request an account
                  </Link>
                  <Link href="/login" className="btn-quiet">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
