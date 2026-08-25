"use client";

/**
 * Admin session handling.
 *
 * The panel signs in against Supabase Auth directly over REST and keeps the
 * resulting access token. There is no Supabase SDK here on purpose: the only
 * thing this app needs from Supabase is a token, and one fetch is easier to
 * reason about than a client library with its own storage and refresh
 * behaviour.
 *
 * The token is the *only* thing stored. Whether the holder is actually an
 * administrator is decided by the API on every request against `admin_users`,
 * never by anything this file could be tricked into believing.
 */

import { useCallback, useEffect, useState } from "react";

// Renaming this key is a one-time sign-out for anyone holding an old session:
// the previous key is simply never read again. That is the correct outcome for
// a rebrand, and cheaper than carrying a migration for a value that is only a
// token cache.
const STORAGE_KEY = "Aravo.admin.session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once the project is wired up; false locally before keys exist. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export type Session = {
  accessToken: string;
  refreshToken: string | null;
  /** Unix seconds. */
  expiresAt: number;
  email: string | null;
};

function read(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    // Treat an expired token as no session at all, so the UI shows the login
    // screen instead of firing requests that are certain to 401.
    if (session.expiresAt * 1000 < Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function write(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  // The browser fires `storage` at OTHER tabs, never the one that wrote. Any
  // `useSession` mounted in this tab would therefore keep serving the session
  // it read when it mounted - which is how setting a password on /reset landed
  // back on the sign-in screen holding a perfectly good session. Announcing the
  // write here means every consumer stays correct regardless of which screen
  // performed it.
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

export class SignInError extends Error {}

/** Seconds before expiry at which a refresh is attempted. */
const REFRESH_MARGIN = 120;

function sessionFrom(body: Record<string, unknown>, fallbackEmail?: string): Session {
  const user = body.user as { email?: string } | undefined;
  return {
    accessToken: body.access_token as string,
    refreshToken: (body.refresh_token as string) ?? null,
    expiresAt:
      Math.floor(Date.now() / 1000) + ((body.expires_in as number) ?? 3600),
    email: user?.email ?? fallbackEmail ?? null,
  };
}

/** Exchange email and password for an access token. */
export async function signIn(email: string, password: string): Promise<Session> {
  if (!supabaseConfigured) {
    throw new SignInError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      }
    );
  } catch {
    throw new SignInError("Could not reach the authentication service.");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // Supabase distinguishes bad credentials from unconfirmed accounts; both
    // are safe to surface, and being vague here just wastes the user's time.
    const detail =
      (body?.error_description as string) || (body?.msg as string) || null;
    throw new SignInError(detail ?? "Email or password is incorrect.");
  }

  const session = sessionFrom(body, email);
  write(session);
  return session;
}

/**
 * Exchange a refresh token for a new access token.
 *
 * Without this the panel logs you out roughly an hour into a session, usually
 * mid-edit, which reads as the tool being broken rather than the token doing
 * its job.
 */
export async function refreshSession(): Promise<Session | null> {
  const current = read();
  if (!current?.refreshToken || !supabaseConfigured) return null;

  try {
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: current.refreshToken }),
      }
    );
    if (!response.ok) {
      // A refused refresh token means the session is genuinely over.
      write(null);
      return null;
    }
    const body = await response.json();
    const next = sessionFrom(body, current.email ?? undefined);
    write(next);
    return next;
  } catch {
    // A network blip should not sign anyone out; the existing token is still
    // valid for a couple more minutes and the next attempt may succeed.
    return null;
  }
}

/**
 * Ask for a reset link.
 *
 * Routed through our own API rather than straight at Supabase. The API is rate
 * limited, it decides where the link lands, and it always reports success so
 * the response cannot be used to find out who has an account. Calling Supabase
 * from the browser skipped all three.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010").replace(
    /\/$/,
    ""
  );
  await fetch(`${base}/api/v1/public/password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch(() => {
    /* deliberately silent: never reveal whether an address has an account */
  });
}

/* ------------------------------------------------------------------ */
/* Invitation and recovery links                                       */
/* ------------------------------------------------------------------ */

/**
 * What Supabase put in the URL after an invitation or recovery link.
 *
 * Both flows deliver their tokens in the fragment rather than the query
 * string, which is why they never reach the server and have to be read here.
 */
export type AuthLink =
  | { kind: "tokens"; accessToken: string; refreshToken: string | null; expiresIn: number; type: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

export function readAuthLink(): AuthLink {
  if (typeof window === "undefined") return { kind: "none" };

  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return { kind: "none" };
  const params = new URLSearchParams(raw);

  const error = params.get("error_description") || params.get("error");
  if (error) {
    const code = params.get("error_code") ?? "";
    // The common case by far, and worth its own sentence: the generic
    // "otp_expired" text Supabase returns does not tell anyone what to do.
    if (code === "otp_expired" || /expired/i.test(error)) {
      return {
        kind: "error",
        message: "That link has expired. Ask for a new one and use it within the hour.",
      };
    }
    return { kind: "error", message: error.replace(/\+/g, " ") };
  }

  const accessToken = params.get("access_token");
  if (!accessToken) return { kind: "none" };

  return {
    kind: "tokens",
    accessToken,
    refreshToken: params.get("refresh_token"),
    expiresIn: Number(params.get("expires_in") ?? 3600),
    type: params.get("type") ?? "recovery",
  };
}

/** Drop the tokens out of the address bar without adding a history entry. */
export function clearAuthLink() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}

/**
 * Set a password using the token from an invitation or recovery link, and sign
 * the person in.
 *
 * This is the only way an invited administrator can ever get a password: the
 * invitation deliberately does not set one, and changing it later requires the
 * current password they do not have.
 */
export async function setPasswordWithLink(
  link: Extract<AuthLink, { kind: "tokens" }>,
  password: string
): Promise<Session> {
  if (!supabaseConfigured) {
    throw new SignInError("Supabase is not configured.");
  }

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${link.accessToken}`,
      },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new SignInError("Could not reach the authentication service.");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      (body?.error_description as string) || (body?.msg as string) || null;
    throw new SignInError(
      detail ?? "That link is no longer valid. Ask for a new one."
    );
  }

  const session: Session = {
    accessToken: link.accessToken,
    refreshToken: link.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + link.expiresIn,
    email: (body?.email as string) ?? null,
  };
  write(session);
  return session;
}

/**
 * Development-only escape hatch.
 *
 * Before a Supabase project exists, a token minted by hand is the only way to
 * exercise the admin screens against a local API. Guarded on NODE_ENV so it
 * cannot ship, and it still proves nothing to the API: the token is verified
 * and the `admin_users` row checked exactly as in production.
 */
export function useDevToken(token: string): Session {
  if (process.env.NODE_ENV === "production") {
    throw new SignInError("Not available.");
  }
  const session: Session = {
    accessToken: token.trim(),
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    email: "dev@localhost",
  };
  write(session);
  return session;
}

/**
 * End the session here and at Supabase.
 *
 * Clearing storage alone left the refresh token valid indefinitely, so
 * "sign out" revoked nothing and anyone holding a copy kept minting access
 * tokens. Fire-and-forget: the local session is gone either way, and a failed
 * network call must not leave someone apparently still signed in.
 */
export function signOut() {
  const current = read();
  write(null);

  if (current && supabaseConfigured) {
    void fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/logout?scope=global`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${current.accessToken}`,
      },
      keepalive: true,
    }).catch(() => {
      /* the local session is already gone; nothing useful to do here */
    });
  }
}

/**
 * The current session, reactive across tabs.
 *
 * `loading` matters: without it every admin screen flashes the login form for
 * one frame before localStorage is read.
 */
export function useSession() {
  // `undefined` means "not read yet", which is what `loading` is derived from.
  // Storing it this way avoids a synchronous setState inside the effect.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setSession(read());
    sync();

    // Signing out in one tab should sign out the others.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Keep the token fresh while the tab is open. Scheduling from the actual
  // expiry rather than a fixed interval means a tab left open overnight
  // refreshes once on wake, not sixty times.
  useEffect(() => {
    if (!session) return;

    const runIn = Math.max(
      5_000,
      (session.expiresAt - REFRESH_MARGIN) * 1000 - Date.now()
    );
    const timer = setTimeout(() => {
      // `?? read()` matters: refreshSession returns null on a network error
      // without clearing storage, and assigning that straight into state
      // signed people out mid-edit over a blip the token had survived.
      refreshSession().then((next) => setSession(next ?? read()));
    }, runIn);

    // A tab that was asleep can wake up past the expiry, so re-check on focus.
    const onFocus = () => {
      const stored = read();
      if (!stored || stored.expiresAt - REFRESH_MARGIN <= Date.now() / 1000) {
        refreshSession().then((next) => setSession(next ?? read()));
      }
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [session]);

  const refresh = useCallback(() => setSession(read()), []);

  const end = useCallback(() => {
    signOut();
    setSession(null);
  }, []);

  return {
    session: session ?? null,
    loading: session === undefined,
    refresh,
    signOut: end,
  };
}
