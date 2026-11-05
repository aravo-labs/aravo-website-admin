"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Table,
  Tabs,
  Td,
  Th,
  ToastStack,
  Tr,
  useToasts,
} from "@/components/ui";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { sdkRequestsApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { RequestStatus, SdkRequest } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync, useDebounced } from "@/lib/useAsync";

const TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "closed", label: "Closed" },
] as const;

const TONE: Record<RequestStatus, "info" | "warning" | "success" | "neutral"> = {
  new: "info",
  contacted: "warning",
  qualified: "success",
  closed: "neutral",
};

const STATUSES: RequestStatus[] = ["new", "contacted", "qualified", "closed"];

export default function SdkRequestsPage() {
  const auth = useAuth();
  const { token } = auth;

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // The box stays responsive; the request waits for a pause in typing.
  const query = useDebounced(search);
  const [open, setOpen] = useState<SdkRequest | null>(null);
  const { toasts, push } = useToasts();

  const state = useAsync(
    () =>
      sdkRequestsApi.list(auth, {
        page,
        page_size: 20,
        q: query || undefined,
        status: tab === "all" ? null : tab,
      }),
    [token, tab, page, query]
  );

  async function setStatus(row: SdkRequest, status: RequestStatus) {
    try {
      await sdkRequestsApi.setStatus(auth, row.id, status);
      push(`Marked ${row.name} as ${status}.`);
      state.reload();
      setOpen((cur) => (cur?.id === row.id ? { ...cur, status } : cur));
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not update.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="SDK requests"
        description="Access and demo requests from the public site."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setPage(1);
          }}
        />
        <Input
          className="max-w-xs"
          placeholder="Search name, email, company"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {state.loading ? (
        <LoadingState label="Loading requests" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="Requests appear as soon as someone asks for SDK access."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Contact</Th>
                <Th>Company</Th>
                <Th>Platform</Th>
                <Th>Received</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <button
                      className="text-left font-medium hover:text-[var(--color-accent)]"
                      onClick={() => setOpen(row)}
                    >
                      {row.name}
                    </button>
                    <div className="text-[length:var(--text-xs)] text-[var(--color-text-subtle)]">
                      {row.email}
                    </div>
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">
                    {row.company ?? "—"}
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">
                    {row.platform ?? "—"}
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">
                    {new Date(row.created_at).toLocaleDateString()}
                  </Td>
                  <Td>
                    <Badge tone={TONE[row.status]}>{row.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setOpen(row)}>
                        Open
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>

          <Pagination
            page={state.data!.pagination?.page ?? 1}
            totalPages={state.data!.pagination?.total_pages ?? 1}
            totalItems={state.data!.pagination?.total_items ?? 0}
            onChange={setPage}
          />
        </>
      )}

      {open && (
        <RequestDetail
          request={open}
          onClose={() => setOpen(null)}
          onStatus={(s) => setStatus(open, s)}
          onSaved={(m) => {
            push(m);
            setOpen(null);
            state.reload();
          }}
        />
      )}

      <ToastStack toasts={toasts} />
    </>
  );
}

function RequestDetail({
  request,
  onClose,
  onStatus,
  onSaved,
}: {
  request: SdkRequest;
  onClose: () => void;
  onStatus: (status: RequestStatus) => void;
  onSaved: (message: string) => void;
}) {
  const auth = useAuth();
  const [notes, setNotes] = useState(request.notes ?? "");
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await sdkRequestsApi.update(auth, request.id, { notes });
      // Saved, so the panel closes. It used to stay open with a toast behind
      // it, which reads as "nothing happened" and invites a second click.
      onSaved("Notes saved.");
    } catch (err) {
      // A failure kept the same path as a success, so a save that never
      // happened announced itself as one and closed the panel over the top of
      // the unsaved text. It stays open, and says why.
      setError(err instanceof ApiRequestError ? err.message : "Could not save notes.");
    } finally {
      setBusy(false);
    }
  }

  const rows: Array<[string, string | null]> = [
    ["Email", request.email],
    ["Company", request.company],
    ["Platform", request.platform],
    ["Fleet size", request.fleet_size],
    ["Received", new Date(request.created_at).toLocaleString()],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={request.name}
      description={request.company ?? undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} loading={busy}>
            Save notes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error && (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger-700)]">
            {error}
          </p>
        )}

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
                {label}
              </dt>
              <dd className="mt-0.5 text-[length:var(--text-sm)] break-words">
                {value ?? <span className="text-[var(--color-text-subtle)]">Not provided</span>}
              </dd>
            </div>
          ))}
        </dl>

        {request.message && (
          <div>
            <p className="font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
              Message
            </p>
            <p className="mt-1 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-4 py-3 text-[length:var(--text-sm)] leading-relaxed">
              {request.message}
            </p>
          </div>
        )}

        <Field label="Status">
          {(p) => (
            <Select
              {...p}
              value={request.status}
              onChange={(e) => onStatus(e.target.value as RequestStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Internal notes">
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={120}
              value={notes}
              onChange={setNotes}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
