"use client";

import { useState } from "react";

/**
 * System overview.
 *
 * Built around one question: is ingestion keeping up? Queue depth alone does
 * not answer it - a large queue that is draining is healthy, and a small one
 * that has not moved in an hour is not - so depth is shown next to the age of
 * the oldest waiting job, which is the number that actually says.
 */

import {
  Badge,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  Stat,
  cx,
} from "@/components/ui";
import { overviewApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";
import { PlatformTrend } from "@/components/PlatformTrend";

/** Beyond this, the queue is not keeping up and somebody should look. */
const QUEUE_AGE_WARNING_SECONDS = 300;
const QUEUE_AGE_DANGER_SECONDS = 1800;

function describeAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "empty";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/** One supporting number under the ingestion verdict. */
function Figure({
  label,
  value,
  danger,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] tracking-[0.08em] text-[var(--color-text-subtle)] uppercase">
        {label}
      </p>
      <p
        className={cx(
          "mt-1 text-[length:var(--text-lg)] tabular-nums",
          danger ? "text-[var(--color-danger-700)]" : "text-[var(--color-text)]",
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

/**
 * How this window compares with the one before it.
 *
 * A total is not a fact anybody can act on until they know which way it is
 * moving. Silent when there is no previous window to compare against, rather
 * than claiming an increase from nothing.
 */
function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0) {
    return now === 0 ? null : <>no traffic in the period before</>;
  }
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <>level with the period before</>;
  return (
    <>
      <span
        className={
          change > 0
            ? "text-[var(--color-success-700)]"
            : "text-[var(--color-text)]"
        }
      >
        {change > 0 ? "+" : ""}
        {change}%
      </span>{" "}
      on the period before
    </>
  );
}

export default function OverviewPage() {
  const { token } = useAuth();
  const state = useAsync(async () => overviewApi.get({ token }), [token]);
  const [days, setDays] = useState(30);
  const trend = useAsync(
    (signal) => overviewApi.trend({ token }, days, signal),
    [token, days],
  );

  if (state.loading) return <LoadingState label="Reading system state" />;
  if (state.error)
    return (
      <ErrorState
        message={state.error.message}
        code={state.error.code}
        requestId={state.error.requestId}
        onRetry={state.reload}
      />
    );

  const o = state.data!;

  // Split the fetched window in half so the second half has something to be
  // compared against. Costs one request instead of two.
  const points = trend.data ?? [];
  const half = Math.floor(points.length / 2);
  const sum = (rows: typeof points, key: "deliveries" | "api_requests") =>
    rows.reduce((n, r) => n + (r[key] ?? 0), 0);
  const windowTotals = {
    deliveries: sum(points.slice(half), "deliveries"),
    requests: sum(points.slice(half), "api_requests"),
  };
  const previousTotals = {
    deliveries: sum(points.slice(0, half), "deliveries"),
    requests: sum(points.slice(0, half), "api_requests"),
  };
  // The days the links above point at. Taken from the series actually shown,
  // so "Deliveries · 30d" opens the same 30 days the card counted rather than
  // a range computed a second way that can disagree with it.
  const todayIso = points[points.length - 1]?.day ?? new Date().toISOString().slice(0, 10);
  const windowStart = points[half]?.day ?? todayIso;

  const age = o.queue_oldest_seconds;
  const queueTone =
    age !== null && age !== undefined && age > QUEUE_AGE_DANGER_SECONDS
      ? "danger"
      : age !== null && age !== undefined && age > QUEUE_AGE_WARNING_SECONDS
        ? "warning"
        : "neutral";

  // What the four ingestion numbers add up to, said once.
  const health =
    o.queue_failed > 0
      ? {
          tone: "danger" as const,
          verdict: "Not keeping up",
          detail: `${o.queue_failed.toLocaleString()} batch${o.queue_failed === 1 ? "" : "es"} gave up after retrying.`,
        }
      : queueTone !== "neutral"
        ? {
            tone: queueTone,
            verdict: "Falling behind",
            detail: `The oldest batch has been waiting ${describeAge(age)}.`,
          }
        : o.queue_depth > 0
          ? {
              tone: "neutral" as const,
              verdict: "Keeping up",
              detail: `${o.queue_depth.toLocaleString()} waiting, and draining.`,
            }
          : {
              tone: "neutral" as const,
              verdict: "Keeping up",
              detail: "Nothing waiting and nothing failed.",
            };

  return (
    <>
      <PageHeader
        title="Overview"
        description="Every company on the platform, and whether ingestion is keeping up."
      />

      <section className="mb-8">
        <Card>
          <div className="p-5">
            <PlatformTrend
              data={trend.data ?? []}
              days={days}
              onDaysChange={setDays}
              loading={trend.loading}
            />
          </div>
        </Card>
      </section>

      {/*
        Ingestion is a verdict, not four numbers.

        Four identical cards reading 0, empty, 0, 0 leave somebody to work out
        for themselves whether that is a healthy morning or a pipeline that
        stopped accepting anything yesterday. The numbers are still here; they
        sit under a sentence saying what they add up to.
      */}
      <section className="mb-8">
        <h2 className="mb-3 font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] tracking-[0.08em] text-[var(--color-text-muted)] uppercase">
          Ingestion
        </h2>
        <Card>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              aria-hidden="true"
              className={cx(
                "inline-block size-2.5 rounded-full",
                health.tone === "danger"
                  ? "bg-[var(--color-danger-500)]"
                  : health.tone === "warning"
                    ? "bg-[var(--color-warning-500)]"
                    : "bg-[var(--color-success-500)]",
              )}
            />
            <span
              className={cx(
                "font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-medium",
                health.tone === "danger"
                  ? "text-[var(--color-danger-700)]"
                  : health.tone === "warning"
                    ? "text-[var(--color-warning-700)]"
                    : "text-[var(--color-text)]",
              )}
            >
              {health.verdict}
            </span>
            <span className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {health.detail}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-4">
            <Figure label="Waiting" value={o.queue_depth} />
            <Figure label="Oldest" value={describeAge(age)} />
            <Figure
              label="Failed"
              value={o.queue_failed}
              danger={o.queue_failed > 0}
            />
            <Figure label="Batches today" value={o.batches_today} />
          </div>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] tracking-[0.08em] text-[var(--color-text-muted)] uppercase">
          Volume
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* A total on its own says nothing about whether it is going up. */}
          {/* Every figure that can be opened, is. A count with nowhere to go
              is where this screen used to stop: it said two deliveries
              happened today and there was no way to see which two. */}
          <Stat
            label={`Deliveries · ${days}d`}
            value={windowTotals.deliveries}
            href={`/deliveries?from=${windowStart}&to=${todayIso}`}
            hint={
              <Delta
                now={windowTotals.deliveries}
                before={previousTotals.deliveries}
              />
            }
          />
          <Stat
            label="Deliveries today"
            value={o.deliveries_today}
            href={`/deliveries?on=${todayIso}`}
          />
          <Stat
            label={`API requests · ${days}d`}
            value={windowTotals.requests}
            hint={
              <Delta
                now={windowTotals.requests}
                before={previousTotals.requests}
              />
            }
          />
          <Stat
            label="Active devices"
            value={o.active_devices}
            hint={
              o.devices - o.active_devices > 0
                ? `${(o.devices - o.active_devices).toLocaleString()} of ${o.devices.toLocaleString()} not seen this week`
                : `all ${o.devices.toLocaleString()} seen this week`
            }
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] tracking-[0.08em] text-[var(--color-text-muted)] uppercase">
          Companies
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total" value={o.companies} href="/companies" />
          <Stat
            label="Active"
            value={o.active_companies}
            href="/companies"
          />
          {/* Its own card when there are any. Buried as hint text under
              "Active", a suspended company is something nobody notices. */}
          {o.companies - o.active_companies > 0 && (
            <Stat
              label="Suspended or pending"
              value={o.companies - o.active_companies}
              tone="warning"
              hint="cannot upload or sign in"
            />
          )}
        </div>
      </section>

      {o.queue_failed > 0 && (
        <Card className="mt-8">
          <div className="flex items-start gap-3">
            <Badge tone="warning">Attention</Badge>
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {o.queue_failed.toLocaleString()} batch
              {o.queue_failed === 1 ? "" : "es"} could not be read after
              retrying. The deliveries they belong to are marked inconclusive
              rather than processed, so nothing is shown as complete when its
              data is incomplete.
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
