"use client";

/**
 * Deliveries across every company.
 *
 * The overview counts them and had nothing to open: the only list was inside a
 * company, so "what were the two deliveries on the 23rd" meant guessing which
 * company to look in before you could look at all. The numbers there now link
 * here with the day already applied.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { DeliveryDetailModal } from "@/components/DeliveryDetailModal";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { platformApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

const STATUSES = [
  "created",
  "started",
  "tracking",
  "completed",
  "processing",
  "processed",
  "inconclusive",
  "failed",
  "cancelled",
];

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "-";
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function tone(status: string) {
  if (status === "processed") return "success" as const;
  if (status === "failed" || status === "cancelled") return "danger" as const;
  if (status === "inconclusive") return "warning" as const;
  return "neutral" as const;
}

function DeliveriesList() {
  const { token } = useAuth();
  const params = useSearchParams();

  // The day arrives in the URL so a link from the overview, or a shared one,
  // opens the same list rather than today's.
  const [on, setOn] = useState(params.get("on") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const state = useAsync(
    (signal) =>
      platformApi.deliveries(
        { token },
        {
          page,
          page_size: 50,
          on: on || undefined,
          status: status || undefined,
          company_id: params.get("company_id") ?? undefined,
        },
        signal,
      ),
    [token, page, on, status, params],
  );

  const filtered = Boolean(on || status);

  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Every delivery on the platform, newest first."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <label
            htmlFor="on"
            className="mb-1.5 block text-[length:var(--text-sm)] font-medium"
          >
            Day
          </label>
          <Input
            id="on"
            type="date"
            value={on}
            onChange={(e) => {
              setOn(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-44">
          <label
            htmlFor="status"
            className="mb-1.5 block text-[length:var(--text-sm)] font-medium"
          >
            Status
          </label>
          <Select
            id="status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        {filtered && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setOn("");
              setStatus("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {state.loading ? (
        <LoadingState label="Loading deliveries" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title={filtered ? "No deliveries match that" : "No deliveries yet"}
          description={
            filtered ? "Try a different day, or clear the filters." : undefined
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Company</Th>
                <Th>Status</Th>
                <Th>Started</Th>
                <Th className="text-right">Duration</Th>
                <Th className="text-right">Batches</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((d) => (
                <Tr key={d.id} onClick={() => setOpen(d.id)}>
                  <Td>
                    <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]">
                      {d.external_reference ?? d.id}
                    </span>
                    {d.device_identifier && (
                      <span className="block font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] text-[var(--color-text-muted)]">
                        {d.device_identifier}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {/* Stops the row click, which would open the modal over
                        the page this is navigating to. */}
                    <Link
                      href={`/companies/detail?id=${d.company_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="underline-offset-2 hover:underline"
                    >
                      {d.company_name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={tone(d.status)}>{d.status}</Badge>
                  </Td>
                  <Td>{when(d.started_at)}</Td>
                  <Td className="text-right">{duration(d.duration_seconds)}</Td>
                  <Td className="text-right">{d.batch_count}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {state.data!.pagination && (
            <Pagination
              page={state.data!.pagination.page}
              totalPages={state.data!.pagination.total_pages}
              totalItems={state.data!.pagination.total_items}
              onChange={setPage}
            />
          )}
        </>
      )}

      {open && (
        <DeliveryDetailModal deliveryId={open} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

export default function DeliveriesPage() {
  // useSearchParams needs a boundary for the static export to build.
  return (
    <Suspense fallback={<LoadingState label="Loading deliveries" />}>
      <DeliveriesList />
    </Suspense>
  );
}
