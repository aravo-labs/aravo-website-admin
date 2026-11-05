"use client";

/**
 * One delivery, opened from the company page.
 *
 * This exists because staff could see less of a delivery than the customer
 * asking them about it: the panel listed summary rows and had no way to open
 * one, while the customer dashboard showed location, events, session context
 * and batches. Somebody fielding "what happened on this run" had to answer it
 * from the database.
 *
 * It reads `/admin/deliveries/{id}`, which returns the same payload the
 * dashboard builds from the same code, so the two cannot drift into showing
 * different things.
 */

import {
  Badge,
  Card,
  ErrorState,
  LoadingState,
  Modal,
  cx,
} from "@/components/ui";
import { companiesApi } from "@/lib/api/admin";
import type { DeliveryDetail } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function bytes(n: number | null | undefined): string {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "-";
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function DeliveryDetailModal({
  deliveryId,
  onClose,
}: {
  deliveryId: string;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const state = useAsync(
    (signal) => companiesApi.delivery({ token }, deliveryId, signal),
    [token, deliveryId],
  );

  const d = state.data;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Delivery"
      description={d?.external_reference ?? deliveryId}
    >
      {state.loading && <LoadingState label="Loading the delivery" />}

      {state.error && (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      )}

      {d && (
        <div className="flex flex-col gap-5">
          <Facts
            rows={[
              ["Status", <Badge key="s">{d.status}</Badge>],
              ["Started", when(d.started_at)],
              ["Completed", when(d.completed_at)],
              ["Duration", duration(d.duration_seconds)],
              ["Handset", d.device_identifier ?? "-"],
              ["Model", d.device_model ?? "-"],
              ["Key", d.api_key_name ?? "-"],
              ["Partner", d.partner_reference ?? "-"],
            ]}
          />

          {/* Their SDK's own context. Absent for a delivery opened through
              our REST API rather than their handset library, which is why
              the whole block is conditional rather than showing eight
              dashes. */}
          {(d.address || d.customer_reference || d.driver_reference ||
            d.group || d.sdk_version) && (
            <Section title="What the SDK sent">
              <Facts
                rows={[
                  ["Address", d.address ?? "-"],
                  ["Customer", d.customer_reference ?? "-"],
                  ["Driver", d.driver_reference ?? "-"],
                  ["Group", d.group ?? "-"],
                  ["SDK version", d.sdk_version ?? "-"],
                ]}
              />
            </Section>
          )}

          {(d.start_location || d.end_location) && (
            <Section
              title="Where it ran"
              note="The coordinates the handset reported at each end. There is no path between them: reconstructing indoor position from these sensors is not something this pipeline can honestly claim."
            >
              <Facts
                rows={[
                  [
                    "Started at",
                    d.start_location
                      ? `${d.start_location.latitude.toFixed(5)}, ${d.start_location.longitude.toFixed(5)}`
                      : "-",
                  ],
                  [
                    "Finished at",
                    d.end_location
                      ? `${d.end_location.latitude.toFixed(5)}, ${d.end_location.longitude.toFixed(5)}`
                      : "-",
                  ],
                ]}
              />
            </Section>
          )}

          <Section
            title="Timeline"
            note={
              d.batches.length === 0 && d.events.length === 0
                ? undefined
                : `${d.sample_count.toLocaleString()} samples across ${d.batches.length} ` +
                  `${d.batches.length === 1 ? "batch" : "batches"}, ${bytes(d.bytes_stored)} stored.`
            }
          >
            {d.batches.length === 0 && d.events.length === 0 ? (
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                Nothing was recorded for this delivery.
              </p>
            ) : (
              <Timeline events={d.events} batches={d.batches} />
            )}
          </Section>


          {d.note && (
            <Section title="Note">
              <p className="text-[length:var(--text-sm)]">{d.note}</p>
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

type Batch = DeliveryDetail["batches"][number];
type Event = DeliveryDetail["events"][number];

/** The clock time of day, which is what reading a timeline needs. */
function clock(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleTimeString() : "-";
}

function span(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return "";
  const seconds = Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 1000,
  );
  if (seconds < 0) return "";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * What a batch carried, as sensor names and their rates.
 *
 * The API records a sample rate per sensor, so this is measured rather than
 * configured: it says what the handset actually managed, which is the number
 * worth seeing when a delivery looks thin.
 */
function sensorChips(sensors: Record<string, unknown> | null | undefined) {
  if (!sensors) return [];
  return Object.entries(sensors)
    .map(([name, hz]) => ({ name, hz: typeof hz === "number" ? hz : null }))
    .sort((a, b) => (b.hz ?? 0) - (a.hz ?? 0));
}

/**
 * Events and batches on one clock, in the order they happened.
 *
 * Two tables, one of events and one of batches, could not answer the question
 * they were there for: what happened during this delivery, and in what order.
 * The batch table was sorted by upload time, which is not when the data was
 * recorded - batches drain on a timer, so several arrive at once long after
 * the moments they describe.
 *
 * So each batch is placed at the window it covers rather than when it landed,
 * and events sit between them. A batch that was uploaded noticeably later than
 * it was recorded says so, because that gap explains most "where is my data"
 * questions on its own.
 */
function Timeline({ events, batches }: { events: Event[]; batches: Batch[] }) {
  type Entry =
    | { kind: "event"; at: number; event: Event }
    | { kind: "batch"; at: number; batch: Batch };

  const entries: Entry[] = [
    ...events.map((e) => ({
      kind: "event" as const,
      at: new Date(e.occurred_at).getTime(),
      event: e,
    })),
    ...batches.map((b) => ({
      kind: "batch" as const,
      // When it was recorded, falling back to when it arrived for a batch
      // whose format carries no window.
      at: new Date(b.start_timestamp ?? b.uploaded_at).getTime(),
      batch: b,
    })),
  ].sort((a, b) => a.at - b.at);

  return (
    <ol className="relative flex flex-col gap-3 border-l border-[var(--color-border)] pl-5">
      {entries.map((entry, i) =>
        entry.kind === "event" ? (
          <li key={`e-${i}`} className="relative">
            <span
              className="absolute top-1.5 -left-[1.4rem] size-2 rounded-full bg-[var(--color-accent)]"
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]">
                {entry.event.name}
              </span>
              <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {clock(entry.event.occurred_at)}
              </span>
            </div>
          </li>
        ) : (
          <BatchEntry key={`b-${entry.batch.id}`} batch={entry.batch} />
        ),
      )}
    </ol>
  );
}

function BatchEntry({ batch }: { batch: Batch }) {
  const chips = sensorChips(batch.sensors as Record<string, unknown> | null);
  const covered = span(batch.start_timestamp, batch.end_timestamp);

  // How long after the window it describes the batch actually arrived. Shown
  // only when it is worth noticing, because for most batches it is seconds.
  const lateBy = batch.end_timestamp
    ? span(batch.end_timestamp, batch.uploaded_at)
    : "";
  const late =
    batch.end_timestamp &&
    new Date(batch.uploaded_at).getTime() -
      new Date(batch.end_timestamp).getTime() >
      60_000;

  return (
    <li className="relative">
      <span
        className="absolute top-2 -left-[1.4rem] size-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)]"
        aria-hidden
      />
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-[length:var(--text-sm)]">
            {batch.start_timestamp ? (
              <>
                {clock(batch.start_timestamp)}
                <span className="text-[var(--color-text-muted)]"> to </span>
                {clock(batch.end_timestamp)}
                {covered && (
                  <span className="text-[var(--color-text-muted)]"> · {covered}</span>
                )}
              </>
            ) : (
              <>
                uploaded {clock(batch.uploaded_at)}
                <span className="text-[var(--color-text-muted)]">
                  {" "}
                  · no window recorded
                </span>
              </>
            )}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)] tabular-nums">
            {(batch.sample_count ?? 0).toLocaleString()} samples ·{" "}
            {bytes(batch.byte_size)} · {batch.payload_format}
          </span>
        </div>

        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.name}
                className="rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] text-[var(--color-text-muted)]"
              >
                {c.name.replace(/_/g, " ")}
                {c.hz !== null && (
                  <span className="text-[var(--color-text-subtle)]">
                    {" "}
                    {c.hz.toFixed(0)} Hz
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        {late && (
          <p className="mt-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            Uploaded {lateBy} after it was recorded.
          </p>
        )}

        <p className="mt-2 font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
          {batch.batch_id}
        </p>
      </div>
    </li>
  );
}



function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[length:var(--text-sm)] font-medium">{title}</h3>
      {note && (
        <p className="mt-0.5 mb-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          {note}
        </p>
      )}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  // Which entries sit in the final row of the two-column grid, and so should
  // not draw a bottom border. That depends on whether the count is odd or
  // even, which CSS cannot ask: a `last:border-0` alone leaves half a line
  // under an even list, and adding `nth-last-child(2)` to fix that breaks the
  // odd case the other way. The component knows the length, so it decides.
  const lastRowStarts = rows.length - (rows.length % 2 === 0 ? 2 : 1);

  return (
    <Card>
      <dl className="grid grid-cols-1 gap-x-6 p-4 sm:grid-cols-2">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={cx(
              // Stacked on a phone, side by side once there is room. Side by
              // side the whole way down, a label one character longer than
              // its neighbour is enough to wrap it: "Finished at" broke
              // across two lines where "Started at" did not, in the same
              // column, directly above it.
              "flex flex-col gap-0.5 border-b border-[var(--color-border)] py-1.5",
              "sm:flex-row sm:justify-between sm:gap-4",
              // One column: only the very last entry ends the list.
              i === rows.length - 1 && "border-b-0",
              // Two columns: everything from the final row down.
              i >= lastRowStarts && "sm:border-b-0",
            )}
          >
            <dt className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {label}
            </dt>
            <dd className="text-[length:var(--text-sm)] sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
