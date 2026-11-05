"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button, Field, Input, LoadingState, cx } from "@/components/ui";
import { AdminSessionProvider } from "@/lib/adminAuth";
import {
  SignInError,
  requestPasswordReset,
  signIn,
  supabaseConfigured,
  useDevToken,
  useSession,
} from "@/lib/auth";

type NavItem = { href: string; label: string; exact?: boolean };

/**
 * Grouped by what somebody came here to do rather than by which table backs
 * it: the queues that arrive on their own, then the content that gets
 * written, then the configuration nobody touches twice in a week.
 */
const NAV: readonly NavItem[] = [
  { href: "/", label: "Overview", exact: true },

  { href: "/applications", label: "Applications" },
  { href: "/sdk-requests", label: "SDK requests" },

  { href: "/jobs", label: "Roles" },
  { href: "/platforms", label: "Platforms" },
  { href: "/docs", label: "SDK docs" },
  { href: "/faqs", label: "Questions" },
  { href: "/pages", label: "Pages" },
  { href: "/team", label: "Team" },
  { href: "/banners", label: "Banners" },

  { href: "/site", label: "Site" },
  { href: "/members", label: "People" },
  { href: "/settings", label: "Mail server" },
  { href: "/account", label: "Account" },
];

/**
 * Routes that must render without a session.
 *
 * `/reset` is where invitation and recovery links land, and the whole point is
 * that whoever follows one cannot sign in yet. Gating it behind the sign-in
 * screen would make it unreachable by exactly the people it exists for.
 */
const PUBLIC_ROUTES: readonly string[] = ["/reset"];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, loading, refresh, signOut } = useSession();
  const pathname = usePathname();

  if (PUBLIC_ROUTES.includes(pathname)) return <>{children}</>;

  if (loading) {
    return (
      <div className="grid min-h-svh place-items-center bg-[var(--color-canvas)]">
        <LoadingState label="Checking your session" />
      </div>
    );
  }

  if (!session) return <SignInScreen onSignedIn={refresh} />;

  return (
    <div className="min-h-svh bg-[var(--color-canvas)] text-[var(--color-text)]">
      <div className="mx-auto flex min-h-svh w-full max-w-[100rem]">
        {/* sidebar */}
        <aside className="hidden w-[var(--layout-sidebar)] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex md:flex-col">
          <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-5 py-4">
            <span className="font-[family-name:var(--font-display)] text-[length:var(--text-sm)] font-medium">
              Aravo
            </span>
            <span className="text-[length:var(--text-xs)] text-[var(--color-text-subtle)]">
              Admin
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 p-3">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as never}
                  className={cx(
                    "rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--text-sm)] transition-colors",
                    active
                      ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-teal-700)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[var(--color-border)] p-3">
            <p className="truncate px-3 pb-2 font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
              {session.email}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={signOut}
            >
              Sign out
            </Button>
          </div>
        </aside>

        {/* content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* mobile nav */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 md:hidden">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as never}
                  className={cx(
                    "shrink-0 rounded-[var(--radius-full)] px-3 py-1.5 text-[length:var(--text-xs)]",
                    active
                      ? "bg-[var(--color-accent-subtle)] text-[var(--color-teal-700)]"
                      : "text-[var(--color-text-muted)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <main className="flex-1 px-5 py-7 sm:px-8 sm:py-9">
            <AdminSessionProvider session={session}>
              {children}
            </AdminSessionProvider>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SignInScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [devToken, setDevToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showDevEntry =
    !supabaseConfigured && process.env.NODE_ENV !== "production";

  async function forgotPassword() {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }
    await requestPasswordReset(email.trim());
    // Always the same message. Whether an address has an account is not
    // something an anonymous visitor gets to learn.
    setNotice(
      "If that address has an account, a reset link is on its way. Check your inbox.",
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      onSignedIn();
    } catch (err) {
      setError(
        err instanceof SignInError ? err.message : "Could not sign you in.",
      );
    } finally {
      setBusy(false);
    }
  }

  function useToken(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      useDevToken(devToken);
      onSignedIn();
    } catch {
      setError("That token could not be used.");
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-[var(--color-canvas)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 grid size-10 place-items-center rounded-[var(--radius-lg)] bg-[var(--color-accent)] font-[family-name:var(--font-display)] text-[length:var(--text-xs)] font-bold tracking-[-0.03em] text-[var(--color-text-inverse)]">
            A
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-medium">
            Admin sign in
          </h1>
          <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            Content, roles and submissions.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]"
        >
          <Field label="Email" required>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          <Field label="Password" required>
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>

          {error && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-accent-subtle)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-teal-700)]">
              {notice}
            </p>
          )}

          <Button type="submit" loading={busy} disabled={!supabaseConfigured}>
            Sign in
          </Button>

          {supabaseConfigured && (
            <button
              type="button"
              onClick={forgotPassword}
              className="text-center text-[length:var(--text-xs)] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
            >
              Forgot password?
            </button>
          )}

          {!supabaseConfigured && (
            <p className="text-center text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              Supabase is not configured yet.
            </p>
          )}
        </form>

        {/* Local development only: lets the admin screens be exercised against
            a local API before a Supabase project exists. */}
        {showDevEntry && (
          <form
            onSubmit={useToken}
            className="mt-4 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] p-4"
          >
            <p className="font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
              Development only
            </p>
            <Field label="Paste an access token">
              {(props) => (
                <Input
                  {...props}
                  value={devToken}
                  onChange={(e) => setDevToken(e.target.value)}
                  placeholder="eyJhbGciOi…"
                />
              )}
            </Field>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={!devToken.trim()}
            >
              Continue
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
