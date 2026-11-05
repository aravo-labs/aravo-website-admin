"use client";

/** Everyone who can sign into a company dashboard, across every company. */

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
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { platformApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";
import { useDebounced } from "@/lib/useDebounced";

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "never";
}

export default function UsersPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const query = useDebounced(q);

  const state = useAsync(
    (signal) =>
      platformApi.users({ token }, { page, page_size: 50, q: query || undefined }, signal),
    [token, page, query],
  );

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with access to a company dashboard."
      />

      <div className="mb-4 w-full max-w-xs">
        <Input
          aria-label="Search users"
          placeholder="Search name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {state.loading ? (
        <LoadingState label="Loading users" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState title={q ? "Nothing matches that" : "No users yet"} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Company</Th>
                <Th>Role</Th>
                <Th>Access</Th>
                <Th className="text-right">Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    {u.name}
                    <span className="block font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] text-[var(--color-text-muted)]">
                      {u.email}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/companies/detail?id=${u.company_id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {u.company_name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={u.role === "company_admin" ? "brand" : "neutral"}>
                      {u.role.replace("_", " ")}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={u.is_active ? "success" : "danger"}>
                      {u.is_active ? "active" : "deactivated"}
                    </Badge>
                  </Td>
                  <Td className="text-right">{when(u.last_seen_at)}</Td>
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
