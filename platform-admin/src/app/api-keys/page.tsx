"use client";

/**
 * Every key on the platform.
 *
 * Only the prefix is ever stored in clear, so nothing here can reconstruct a
 * key and nothing here is a way to read one. What it answers is which
 * companies hold live credentials, which keys are mid-rotation, and which have
 * never been used — a key issued months ago and never touched is usually a
 * customer who never finished integrating.
 */

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  EmptyState,
  ErrorState,
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

function ago(value: string | null | undefined): string {
  if (!value) return "never used";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function PlatformKeysPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const state = useAsync(
    (signal) =>
      platformApi.keys(
        { token },
        { page, page_size: 50, status: status || null },
        signal,
      ),
    [token, page, status],
  );

  return (
    <>
      <PageHeader
        title="API keys"
        description="Across every company. Only the prefix is stored, so none of these can be read back."
      />

      <div className="mb-4 w-44">
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </Select>
      </div>

      {state.loading ? (
        <LoadingState label="Loading keys" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState title="No keys" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Name</Th>
                <Th>Key</Th>
                <Th>Status</Th>
                <Th className="text-right">Last used</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((k) => {
                const retiring = k.expires_at && k.status === "active";
                return (
                  <Tr key={k.id}>
                    <Td>
                      <Link
                        href={`/companies/detail?id=${k.company_id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {k.company_name}
                      </Link>
                    </Td>
                    <Td>{k.name}</Td>
                    <Td className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]">
                      {k.prefix}…
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          k.status === "revoked"
                            ? "neutral"
                            : retiring
                              ? "warning"
                              : "success"
                        }
                      >
                        {k.status === "revoked"
                          ? "revoked"
                          : retiring
                            ? "retiring"
                            : "active"}
                      </Badge>
                    </Td>
                    <Td className="text-right">{ago(k.last_used_at)}</Td>
                  </Tr>
                );
              })}
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
