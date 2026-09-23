"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/marketing/AuthShell";
import { ApiError } from "@/lib/api";
import { confirmEmailVerification } from "@/lib/auth";

/**
 * Where the link in the confirmation email lands.
 *
 * Deliberately outside the signed-in shell and asking for no session: mail
 * apps open links in their own browser, which is rarely the one holding the
 * session. The token in the URL is signed and names the account, so it stands
 * on its own.
 *
 * Nothing here is a gate. Someone who never opens this page keeps a working
 * account; all they lose is our confidence that we can reach them.
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Shell>Confirming…</Shell>}>
      <Confirm />
    </Suspense>
  );
}

function Confirm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [message, setMessage] = useState("");
  // React runs effects twice in dev; the request is not idempotent enough to
  // want two of them racing for the same token.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    if (!token) {
      setState("failed");
      setMessage("That link is missing its token. Open the one we emailed you.");
      return;
    }

    confirmEmailVerification(token)
      .then((result) => {
        setState("done");
        setMessage(result.detail);
      })
      .catch((caught: unknown) => {
        setState("failed");
        setMessage(
          caught instanceof ApiError
            ? caught.message
            : "Could not confirm that link. Try again from your profile.",
        );
      });
  }, [token]);

  if (state === "working") return <Shell>Confirming…</Shell>;

  return (
    <AuthShell>
      <h1 className="font-display text-display">
        {state === "done" ? "Email confirmed" : "That link did not work"}
      </h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">{message}</p>
      {state === "failed" ? (
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          Links last 24 hours. Your profile can send a fresh one.
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/profile" className="btn-primary">
          Your profile
        </Link>
        <Link href="/projects" className="btn-quiet">
          Projects
        </Link>
      </div>
    </AuthShell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <p className="text-[0.9375rem] text-faint">{children}</p>
    </AuthShell>
  );
}
