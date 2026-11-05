"use client";

/**
 * What every handset collects unless its company says otherwise.
 *
 * This is the dial between "record everything" and "record almost nothing",
 * applied without shipping an app update - which also makes it the dial
 * between a courier's phone lasting a shift and not. A change here lifts
 * every company that has not overridden the particular setting, so the screen
 * says that before anything is pressed rather than after.
 *
 * Per-company overrides live on the company page, next to that company's
 * devices and deliveries, because that is where somebody is standing when
 * they decide one fleet needs different treatment.
 */

import Link from "next/link";

import { ConfigEditor } from "@/components/ConfigEditor";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { configApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";
import type { JsonObject } from "@/lib/config/document";

export default function ConfigPage() {
  const { token } = useAuth();
  const state = useAsync(
    (signal) => configApi.platform({ token }, signal),
    [token],
  );

  return (
    <>
      <PageHeader
        title="Handset configuration"
        description="What the SDK collects, how often, and how it batches what it has collected. Handsets read this when a session starts."
        actions={
          <Link
            href="/companies"
            className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
          >
            Set one company instead
          </Link>
        }
      />

      {state.loading && <LoadingState label="Loading the configuration" />}

      {state.error && (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      )}

      {state.data && (
        <ConfigEditor
          data={state.data}
          scope="the platform default"
          parentName="the shipped defaults"
          onSave={(overrides: JsonObject) =>
            configApi.setPlatform({ token }, overrides).then((saved) => {
              state.setData(saved);
              return saved;
            })
          }
        />
      )}
    </>
  );
}
