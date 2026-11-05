"use client";

/**
 * Where invitation and password-recovery links land.
 *
 * Both flows arrive here in the same shape - Supabase redirects with the token
 * in the URL fragment - so they share one page and differ only in wording.
 * Without it an invited administrator can never set a password: the invitation
 * deliberately does not create one, and `/admin/me/password` requires the
 * current password they have never had.
 *
 * The token in the fragment is a real access token, so it is read once and
 * removed from the address bar immediately rather than being left in history.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button, Field, Input, LoadingState } from "@/components/ui";
import {
  SignInError,
  clearAuthLink,
  readAuthLink,
  setPasswordWithLink,
  type AuthLink,
} from "@/lib/auth";

/** Mirrors the API's rule, so the two cannot disagree about what is valid. */
function passwordProblem(value: string): string | null {
  if (value.length < 10) return "Use at least 10 characters.";
  if (value.trim() !== value) return "Password cannot start or end with a space.";
  if (new Set(value).size < 5) return "That is too repetitive to be a password.";
  return null;
}

/**
 * The URL fragment is an external store, not React state: it exists before the
 * component and is read exactly once. Memoised because `useSyncExternalStore`
 * demands a referentially stable snapshot, and because the fragment is stripped
 * from the address bar immediately afterwards - a second read would find
 * nothing. A link is always opened from an email, so the page loads fresh and
 * this cache never outlives the visit it belongs to.
 */
let cachedLink: AuthLink | null = null;
function linkSnapshot(): AuthLink {
  if (cachedLink === null) cachedLink = readAuthLink();
  return cachedLink;
}
/** The fragment cannot change without a reload, so there is nothing to watch. */
const noSubscribe = () => () => {};

export default function ResetPage() {
  const router = useRouter();
  // `null` on the server and during hydration, which renders the loading state.
  const link = useSyncExternalStore(noSubscribe, linkSnapshot, () => null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The token is a live access token, so get it out of the address bar and out
  // of session history as soon as it has been read.
  useEffect(() => {
    if (link?.kind === "tokens") clearAuthLink();
  }, [link]);

  if (link === null) {
    return (
      <Centered>
        <LoadingState label="Checking your link" />
      </Centered>
    );
  }

  const isInvite = link.kind === "tokens" && link.type === "invite";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (link?.kind !== "tokens") return;

    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("Those two passwords do not match.");

    setBusy(true);
    try {
      await setPasswordWithLink(link, password);
      // Storing the session announces itself, so the shell has already picked
      // it up by the time this navigation lands.
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof SignInError ? err.message : "Could not set your password."
      );
      setBusy(false);
    }
  }

  return (
    <Centered>
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 grid size-10 place-items-center rounded-[var(--radius-lg)] bg-[var(--color-accent)] font-[family-name:var(--font-display)] text-[length:var(--text-xs)] font-bold tracking-[-0.03em] text-[var(--color-text-inverse)]">
            A
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-medium">
            {link.kind === "tokens"
              ? isInvite
                ? "Welcome to Aravo"
                : "Choose a new password"
              : "That link did not work"}
          </h1>
          <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {link.kind === "tokens"
              ? isInvite
                ? "Pick a password and you are in."
                : "Once it is set you will be signed in."
              : "Nothing has changed on your account."}
          </p>
        </div>

        {link.kind === "tokens" ? (
          <form
            onSubmit={submit}
            className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]"
          >
            <Field label="New password" required hint="At least 10 characters.">
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>

            <Field label="Confirm password" required>
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              )}
            </Field>

            {error && (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
                {error}
              </p>
            )}

            <Button type="submit" loading={busy}>
              {isInvite ? "Set password and continue" : "Set new password"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-sm)]">
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {link.kind === "error"
                ? link.message
                : "This page needs an invitation or reset link. Open the one that was emailed to you."}
            </p>
            <Button variant="secondary" onClick={() => router.replace("/")}>
              Back to sign in
            </Button>
          </div>
        )}
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-[var(--color-canvas)] px-4">
      {children}
    </div>
  );
}
