"use client";

/**
 * Where the emailed confirmation link lands.
 *
 * Deliberately not automatic. Opening a link should not delete anything on its
 * own: mail clients and security scanners fetch URLs without a person
 * deciding to, and a GET that wipes the platform would eventually be triggered
 * by a spam filter. So this page reads the token, says exactly what will go,
 * and waits for a deliberate press.
 *
 * It also sits behind the admin login like every other page here, so the link
 * alone is not enough. Whoever opens it has to be signed in as staff.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { platformApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

function Confirm() {
  const { token } = useAuth();
  const params = useSearchParams();
  const confirmation = params.get("token") ?? "";

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useAsync(
    (signal) => platformApi.clearPreview({ token }, signal),
    [token],
  );

  async function erase() {
    setBusy(true);
    setError(null);
    try {
      const result = await platformApi.confirmClear({ token }, confirmation);
      setDone(result.removed);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "That link is not valid any more. Links work once and expire.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!confirmation) {
    return (
      <>
        <PageHeader title="Erase delivery data" />
        <Card>
          <p className="text-[length:var(--text-sm)]">
            This page needs the link from the confirmation email. Open it from
            there.
          </p>
        </Card>
      </>
    );
  }

  if (done) {
    const removed = Object.entries(done).filter(([, n]) => n > 0);
    return (
      <>
        <PageHeader title="Erased" />
        <Card>
          <CardHeader
            title="The data is gone"
            description="Companies, user accounts and API keys were not touched."
          />
          {removed.length === 0 ? (
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              There was nothing left to remove.
            </p>
          ) : (
            <dl className="flex flex-wrap gap-x-6 gap-y-1">
              {removed.map(([name, n]) => (
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
          <div className="mt-5">
            <Link href="/">
              <Button variant="secondary">Back to the overview</Button>
            </Link>
          </div>
        </Card>
      </>
    );
  }

  const counts = preview.data?.counts ?? {};
  const listed = Object.entries(counts).filter(([, n]) => n > 0);

  return (
    <>
      <PageHeader
        title="Erase delivery data"
        description="This is the second step. Pressing the button below is what deletes."
      />
      <Card className="border-[color-mix(in_srgb,var(--color-danger-500)_30%,transparent)]">
        {preview.loading ? (
          <LoadingState label="Counting what would go" />
        ) : preview.error ? (
          <ErrorState
            message={preview.error.message}
            code={preview.error.code}
            requestId={preview.error.requestId}
            onRetry={preview.reload}
          />
        ) : (
          <>
            <CardHeader
              title="This cannot be undone"
              description="Companies, user accounts and API keys are not affected: nobody is signed out and no key stops working."
            />
            {listed.length === 0 ? (
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                There is nothing left to erase.
              </p>
            ) : (
              <dl className="mb-5 flex flex-wrap gap-x-6 gap-y-1">
                {listed.map(([name, n]) => (
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

            {error && (
              <p className="mb-3 text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="danger"
                loading={busy}
                disabled={listed.length === 0}
                onClick={erase}
              >
                Erase it
              </Button>
              <Link href="/">
                <Button variant="secondary">Cancel</Button>
              </Link>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

export default function ClearDataPage() {
  // useSearchParams needs a boundary for the static export to build.
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <Confirm />
    </Suspense>
  );
}
