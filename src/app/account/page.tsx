"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  ToastStack,
  useToasts,
} from "@/components/ui";
import { membersApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

const MIN_LENGTH = 10;

export default function AccountPage() {
  const auth = useAuth();
  const { token } = auth;
  const { toasts, push } = useToasts();

  const state = useAsync(() => membersApi.me(auth), [token]);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checked here purely to save a round trip; the API enforces its own rules
  // regardless of what this form decides.
  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const canSubmit =
    current.length > 0 && next.length >= MIN_LENGTH && next === confirm && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await membersApi.changePassword(auth, {
        current_password: current,
        new_password: next,
      });
      push("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.summary : "Could not change your password."
      );
    } finally {
      setBusy(false);
    }
  }

  if (state.loading) return <LoadingState label="Loading your account" />;
  if (state.error)
    return (
      <ErrorState
        message={state.error.message}
        code={state.error.code}
        requestId={state.error.requestId}
        onRetry={state.reload}
      />
    );

  const me = state.data!;

  return (
    <>
      <PageHeader title="Your account" description="Your details and password." />

      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardHeader title="Details" />
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              ["Name", me.name],
              ["Email", me.email ?? "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
                  {label}
                </dt>
                <dd className="mt-1 text-[length:var(--text-sm)] break-words">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
                Role
              </dt>
              <dd className="mt-1">
                <Badge tone={me.role === "owner" ? "brand" : "neutral"}>{me.role}</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Change password"
            description={`At least ${MIN_LENGTH} characters. Length matters more than symbols.`}
          />
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Current password" required>
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              )}
            </Field>

            <Field
              label="New password"
              required
              error={tooShort ? `Use at least ${MIN_LENGTH} characters.` : undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  autoComplete="new-password"
                  invalid={tooShort}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              )}
            </Field>

            <Field
              label="Confirm new password"
              required
              error={mismatch ? "These do not match." : undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  autoComplete="new-password"
                  invalid={mismatch}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              )}
            </Field>

            {error && (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger-700)]">
                {error}
              </p>
            )}

            <div>
              <Button type="submit" loading={busy} disabled={!canSubmit}>
                Change password
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <ToastStack toasts={toasts} />
    </>
  );
}
