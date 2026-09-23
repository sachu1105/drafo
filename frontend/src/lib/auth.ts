"use client";

/**
 * Architect auth. There is deliberately no client-side equivalent of this
 * file: the client has no account, no session and nothing to sign into.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./api";
import type { Architect } from "./types";

export type Registration = {
  email: string;
  /** Optional: an account that never gives one is named by its practice. */
  full_name: string;
  practice_name: string;
  password: string;
};

/**
 * Create an account. There is no queue and no wall: the server opens the
 * session and hands back the account, so the caller goes straight in.
 */
export async function register(form: Registration): Promise<Architect> {
  return api<Architect>("/auth/register/", { method: "POST", body: { ...form } });
}

/** Email me the link that confirms my address. */
export async function sendEmailVerification(): Promise<{ detail: string }> {
  return api("/auth/verify-email/send/", { method: "POST" });
}

/** Spend the token from that email. No session needed: the token is signed. */
export async function confirmEmailVerification(
  token: string,
): Promise<{ detail: string; email: string }> {
  return api("/auth/verify-email/confirm/", { method: "POST", body: { token } });
}

export async function login(email: string, password: string): Promise<Architect> {
  return api<Architect>("/auth/login/", {
    method: "POST",
    body: { email, password },
  });
}

/** Everything on the profile screen: the person, the practice and the card. */
export async function updateProfile(form: FormData): Promise<Architect> {
  return api<Architect>("/auth/me/", { method: "PATCH", body: form });
}

export async function logout(): Promise<void> {
  await api<void>("/auth/logout/", { method: "POST" });
}

export async function me(): Promise<Architect> {
  return api<Architect>("/auth/me/");
}

type State = { architect: Architect | null; loading: boolean };

/** Guard for the architect shell: send anyone without a session to /login. */
export function useArchitect(): State {
  const router = useRouter();
  const [state, setState] = useState<State>({ architect: null, loading: true });

  useEffect(() => {
    let active = true;
    me()
      .then((architect) => {
        if (active) setState({ architect, loading: false });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          router.replace("/login");
        }
        setState({ architect: null, loading: false });
      });
    return () => {
      active = false;
    };
  }, [router]);

  return state;
}

// The client is asked for their name exactly once, at the moment of their
// first approval, and we remember it on their own device. No account, no OTP.
const NAME_KEY = "atelier.client-name";

export function rememberedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private browsing: they will simply be asked again */
  }
}
