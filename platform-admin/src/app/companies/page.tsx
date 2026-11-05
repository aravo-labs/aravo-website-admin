"use client";

/**
 * Every company on the platform.
 *
 * The numbers here are measured, not claimed. Registration asks how many
 * delivery partners a company has and how many deliveries a day they do; those are
 * guesses typed by whoever signed up and are wrong within a month. What is
 * shown is the device and delivery counts the platform actually observed.
 */

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
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
  type Tone,
} from "@/components/ui";
import { companiesApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import type { CompanyStatus } from "@/lib/api/types";
import { useAsync } from "@/lib/useAsync";
import { useDebounced } from "@/lib/useDebounced";

const STATUS_TONE: Record<CompanyStatus, Tone> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

function whenLast(value: string | null | undefined): string {
  if (!value) return "never";
  const days = Math.floor(
    (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString();
}

export default function CompaniesPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  // The search box settles before it is queried; the status select does not
  // need to, because choosing one is already a single deliberate action.
  const query = useDebounced(q);

  const state = useAsync(
    (signal) =>
      companiesApi.list(
        { token },
        { page, page_size: 25, q: query || undefined, status: status || null },
        signal,
      ),
    [token, page, query, status],
  );

  return (
    <>
      <PageHeader
        title="Companies"
        description="Usage and device counts as measured, not as self-reported at signup."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
        <Input
          placeholder="Search name or handle"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        </div>
        <div className="w-44">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </Select>
        </div>
      </div>

      {state.loading ? (
        <LoadingState label="Loading companies" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title={q || status ? "Nothing matches that" : "No companies yet"}
          description={
            q || status
              ? "Try a different search, or clear the filter."
              : "Companies appear here as soon as they register."
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Status</Th>
                <Th className="text-right">Devices</Th>
                <Th className="text-right">Deliveries</Th>
                <Th className="text-right">API calls, 30d</Th>
                <Th>Last delivery</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <Link
                      href={`/companies/detail?id=${c.id}`}
                      className="font-medium text-[var(--color-text)] underline-offset-2 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="block font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                      {c.slug}
                      {c.location ? ` · ${c.location}` : ""}
                    </span>
                  </Td>
                  <Td>
                    <Badge
                      tone={STATUS_TONE[c.status as CompanyStatus] ?? "neutral"}
                    >
                      {c.status}
                    </Badge>
                  </Td>
                  <Td className="text-right font-[family-name:var(--font-mono)] tabular-nums">
                    {c.active_device_count.toLocaleString()}
                    <span className="text-[var(--color-text-muted)]">
                      {" / "}
                      {c.device_count.toLocaleString()}
                    </span>
                  </Td>
                  <Td className="text-right font-[family-name:var(--font-mono)] tabular-nums">{c.delivery_count.toLocaleString()}</Td>
                  <Td className="text-right font-[family-name:var(--font-mono)] tabular-nums">{c.api_calls_30d.toLocaleString()}</Td>
                  <Td>{whenLast(c.last_activity_at)}</Td>
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
    </>
  );
}
