"use client";

/**
 * The signed-in administrator.
 *
 * There is no "change password" form because this service never holds a
 * password to change. Setting a new one goes through the same emailed link as
 * a reset, which is one flow to keep correct rather than two.
 *
 * None of that is said in the user interface. Which identity provider is
 * behind the login is our implementation detail, and naming it in a product
 * someone else is buying reads as an apology for how it was built. It also
 * tells anybody looking at the screen exactly what to attack.
 */

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  LoadingState,
  PageHeader,
  ToastStack,
  useToasts,
} from "@/components/ui";
import { meApi, platformApi } from "@/lib/api/admin";
import type { ClearRequested } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";
import { requestPasswordReset, signOut } from "@/lib/auth";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-border)] py-2 last:border-0">
      <span className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="text-[length:var(--text-sm)] text-[var(--color-text)]">
        {value}
      </span>
    </div>
  );
}

export default function AccountPage() {
  const { token } = useAuth();
  const { toasts, push } = useToasts();
  const state = useAsync(() => meApi.get({ token }), [token]);

  if (state.loading) return <LoadingState label="Loading account" />;
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
      <PageHeader
        title="Account"
        description="Your access to the platform panel."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="You" />
          <DetailRow label="Name" value={me.name} />
          <DetailRow
            label="Email"
            value={
              <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]">
                {me.email}
              </span>
            }
          />
          <DetailRow
            label="Access"
            value={
              <Badge tone={me.is_active ? "success" : "danger"}>
                {me.is_active ? "platform staff" : "revoked"}
              </Badge>
            }
          />
        </Card>

        <Card>
          <CardHeader
            title="Password"
            description="We never store your password, so it cannot be shown or changed here. Use the link below to set a new one."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await requestPasswordReset(me.email);
                  push("Check your email for the link.");
                } catch {
                  push("Could not send that email.", "danger");
                }
              }}
            >
              Email me a reset link
            </Button>
            <Button variant="ghost" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </Card>
      </div>

      <ClearDataCard />

      <Card className="mt-4">
        <CardHeader
          title="What this panel can see"
          description="Everything, across every company. That is why it is a separate application behind its own login, with its own accounts, and why nothing a customer can reach shares an identity with it."
        />
      </Card>

      <ToastStack toasts={toasts} />
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Erasing the platform's operational data.
 *
 * Two steps, because this cannot be undone and whoever presses it cannot
 * reverse it. Pressing asks; a link is emailed to a fixed address and opening
 * that link is what deletes. So the button here is safe to press by accident,
 * which is the only reason it is allowed to exist on a page people visit for
 * other reasons.
 *
 * It names what goes and what stays before it is pressed. "Clear all data" is
 * the kind of phrase people read as narrower than it is.
 */
function ClearDataCard() {
  const { token } = useAuth();
  const [asked, setAsked] = useState<ClearRequested | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useAsync(
    (signal) => platformApi.clearPreview({ token }, signal),
    [token],
  );

  const counts = preview.data?.counts ?? {};
  const total = Object.values(counts).reduce((n, v) => n + v, 0);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      setAsked(await platformApi.requestClear({ token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 border-[color-mix(in_srgb,var(--color-danger-500)_30%,transparent)]">
      <CardHeader
        title="Erase delivery data"
        description="Removes what the handsets produced. Companies, user accounts and API keys are not touched, so nobody is signed out and no key stops working."
      />

      {preview.loading ? (
        <LoadingState label="Counting" />
      ) : preview.error ? (
        <ErrorState
          message={preview.error.message}
          code={preview.error.code}
          requestId={preview.error.requestId}
          onRetry={preview.reload}
        />
      ) : asked ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-4">
          <p className="text-[length:var(--text-sm)]">
            A confirmation link was sent to{" "}
            <span className="font-[family-name:var(--font-mono)]">
              {asked.sent_to}
            </span>
            . Nothing has been deleted. Opening that link within{" "}
            {asked.expires_in_minutes} minutes is what erases the data.
          </p>
        </div>
      ) : (
        <>
          {total === 0 ? (
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              There is nothing to erase.
            </p>
          ) : (
            <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-1">
              {Object.entries(counts)
                .filter(([, n]) => n > 0)
                .map(([name, n]) => (
                  <div key={name} className="flex items-baseline gap-1.5">
                    <dt className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                      {name.replace(/_/g, " ")}
                    </dt>
                    <dd className="font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] tabular-nums">
                      {n.toLocaleString()}
                    </dd>
                  </div>
                ))}
            </dl>
          )}

          {preview.data?.confirmation_sent_to ? (
            <p className="mb-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              A confirmation link goes to{" "}
              <span className="font-[family-name:var(--font-mono)]">
                {preview.data.confirmation_sent_to}
              </span>
              . Nothing is deleted until it is opened.
            </p>
          ) : (
            <p className="mb-3 text-[length:var(--text-xs)] text-[var(--color-warning-700)]">
              No confirmation address is configured, so this cannot be confirmed
              by anyone.
            </p>
          )}

          {error && (
            <p className="mb-3 text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
              {error}
            </p>
          )}

          <Button
            variant="danger"
            loading={busy}
            disabled={total === 0 || !preview.data?.confirmation_sent_to}
            onClick={ask}
          >
            Request erasure
          </Button>
        </>
      )}
    </Card>
  );
}
