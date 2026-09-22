"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserMenu } from "@/components/architect/UserMenu";
import { logout, useArchitect } from "@/lib/auth";

/**
 * The architect shell.
 *
 * Nobody but the architect sees this, so it is dense and quick rather than
 * decorated -- but it is still the tool they open every day, so the chrome
 * stays out of the way: one bar, one rule under it, and the work below.
 */
export default function ArchitectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { architect, loading } = useArchitect();

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-[73px] border-b border-rule" />
        <div className="mx-auto max-w-shell px-4 py-10 text-[0.875rem] text-faint sm:px-8">
          Loading…
        </div>
      </div>
    );
  }
  if (!architect) return null; // useArchitect has already redirected

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <Link
            href="/projects"
            className="flex min-h-[44px] items-center transition-opacity duration-150
                       hover:opacity-70"
          >
            {architect.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={architect.logo_url}
                alt={architect.practice_name}
                className="max-h-11 w-auto max-w-[240px] object-contain object-left"
              />
            ) : (
              <span className="font-display text-[1.75rem] leading-none tracking-tight">
                {architect.practice_name}
              </span>
            )}
          </Link>

          <UserMenu architect={architect} onSignOut={signOut} />
        </div>
      </header>

      {children}
    </div>
  );
}
