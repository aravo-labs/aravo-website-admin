"use client";

/**
 * One company: what they told us, what they actually do, and the two controls
 * that can change either.
 *
 * Suspending is immediate and total - the dashboard, every API key and every
 * live device token stop working on the next request - so the screen says that
 * before the button is pressed rather than after.
 */

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Stat,
  Table,
  Tabs,
  Td,
  Th,
  ToastStack,
  Tr,
  useToasts,
  type Tone,
} from "@/components/ui";
import { DeliveryDetailModal } from "@/components/DeliveryDetailModal";
import { companiesApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { ApiRequestError } from "@/lib/api/client";
import type {
  Company,
  CompanySummary,
  CompanyStatus,
  DeliveryStatus,
  UsagePoint,
} from "@/lib/api/types";
import { useAsync } from "@/lib/useAsync";

const STATUS_TONE: Record<CompanyStatus, Tone> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

/**
 * `processing` and `inconclusive` are not failures and must not be coloured
 * like them. A delivery is processing while its batches are still being read,
 * and inconclusive when the sensor data could not be used - a phone that was
 * off, in a bag, or force closed. That is a real outcome, not a fault in the
 * platform, and showing it in red teaches an operator to chase the wrong thing.
 */
const DELIVERY_TONE: Record<DeliveryStatus, Tone> = {
  created: "neutral",
  started: "info",
  tracking: "info",
  completed: "info",
  processing: "info",
  processed: "success",
  inconclusive: "warning",
  failed: "danger",
  cancelled: "neutral",
};

type TabKey = "overview" | "devices" | "deliveries" | "people";

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "never";
}

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

export default function CompanyDetailPage() {
  // The id arrives as a query parameter rather than a path segment, so this
  // page is a static file that any company can be opened in. A path segment
  // would need one pre-rendered page per company id, and the ids are uuids
  // that only exist at runtime.
  const id = useSearchParams().get("id") ?? "";
  const { token } = useAuth();
  const { toasts, push } = useToasts();
  const [tab, setTab] = useState<TabKey>("overview");
  const [devicePage, setDevicePage] = useState(1);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [openDelivery, setOpenDelivery] = useState<string | null>(null);

  const company = useAsync(() => companiesApi.get({ token }, id), [token, id]);
  // One request for the whole overview. Five would arrive at five different
  // moments and move the layout under whoever is reading it.
  const summary = useAsync(
    (signal) =>
      tab === "overview"
        ? companiesApi.summary({ token }, id, signal)
        : Promise.resolve(null),
    [token, id, tab],
  );
  const members = useAsync(
    () => (tab === "people" ? companiesApi.members({ token }, id) : Promise.resolve([])),
    [token, id, tab],
  );
  const devices = useAsync(
    () =>
      tab === "devices"
        ? companiesApi.devices({ token }, id, { page: devicePage, page_size: 25 })
        : Promise.resolve({ items: [], pagination: null }),
    [token, id, tab, devicePage],
  );
  const deliveries = useAsync(
    () =>
      tab === "deliveries"
        ? companiesApi.deliveries({ token }, id, { page: deliveryPage, page_size: 25 })
        : Promise.resolve({ items: [], pagination: null }),
    [token, id, tab, deliveryPage],
  );

  if (company.loading) return <LoadingState label="Loading company" />;
  if (company.error)
    return (
      <ErrorState
        message={company.error.message}
        code={company.error.code}
        requestId={company.error.requestId}
        onRetry={company.reload}
      />
    );

  const c = company.data!;

  return (
    <>
      <PageHeader
        title={c.name}
        description={c.slug}
        actions={
          <>
            <Badge tone={STATUS_TONE[c.status as CompanyStatus] ?? "neutral"}>
              {c.status}
            </Badge>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Change status
            </Button>
          </>
        }
      />

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "devices", label: "Devices" },
          { id: "deliveries", label: "Deliveries" },
          { id: "people", label: "People" },
        ]}
      />

      {tab === "overview" && (
        <div className="mt-6">
          {summary.loading ? (
            <LoadingState label="Loading this company" />
          ) : summary.error ? (
            <ErrorState
              message={summary.error.message}
              code={summary.error.code}
              requestId={summary.error.requestId}
              onRetry={summary.reload}
            />
          ) : (
            <CompanyOverview company={c} summary={summary.data!} />
          )}
        </div>
      )}

      {tab === "devices" && (
        <div className="mt-6">
          {devices.loading ? (
            <LoadingState label="Loading devices" />
          ) : devices.error ? (
            <ErrorState
              message={devices.error.message}
              code={devices.error.code}
              requestId={devices.error.requestId}
              onRetry={devices.reload}
            />
          ) : (devices.data?.items ?? []).length === 0 ? (
            <EmptyState
              title="No devices registered"
              description="A handset appears here the first time it presents this company's API key."
            />
          ) : (
            <>
            <Table>
              <thead>
                <tr>
                  <Th>Device</Th>
                  <Th>Model</Th>
                  <Th>App</Th>
                  <Th>Status</Th>
                  <Th>Last seen</Th>
                </tr>
              </thead>
              <tbody>
                {(devices.data?.items ?? []).map((d) => (
                  <Tr key={d.id}>
                    <Td className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]">
                      {d.device_identifier}
                    </Td>
                    <Td>
                      {d.model ?? "unknown"}
                      {d.os_version ? (
                        <span className="text-[var(--color-text-muted)]">
                          {" "}
                          · {d.platform} {d.os_version}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{d.app_version ?? "unknown"}</Td>
                    <Td>
                      <Badge tone={d.status === "active" ? "success" : "neutral"}>
                        {d.status}
                      </Badge>
                    </Td>
                    <Td>{when(d.last_seen_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
              {devices.data?.pagination && (
                <Pagination
                  page={devices.data.pagination.page}
                  totalPages={devices.data.pagination.total_pages}
                  totalItems={devices.data.pagination.total_items}
                  onChange={setDevicePage}
                />
              )}
            </>
          )}
        </div>
      )}

      {tab === "deliveries" && (
        <div className="mt-6">
          {deliveries.loading ? (
            <LoadingState label="Loading deliveries" />
          ) : deliveries.error ? (
            <ErrorState
              message={deliveries.error.message}
              code={deliveries.error.code}
              requestId={deliveries.error.requestId}
              onRetry={deliveries.reload}
            />
          ) : (deliveries.data?.items ?? []).length === 0 ? (
            <EmptyState
              title="No deliveries yet"
              description="Sessions appear here as soon as a handset or a dispatch system opens one."
            />
          ) : (
            <>
            <Table>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Status</Th>
                  <Th>Started</Th>
                  <Th className="text-right">Duration</Th>
                  <Th className="text-right">Batches</Th>
                </tr>
              </thead>
              <tbody>
                {(deliveries.data?.items ?? []).map((d) => (
                  <Tr key={d.id} onClick={() => setOpenDelivery(d.id)}>
                    <Td className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]">
                      {d.external_reference ?? d.id.slice(0, 8)}
                    </Td>
                    <Td>
                      <Badge
                        tone={DELIVERY_TONE[d.status as DeliveryStatus] ?? "neutral"}
                      >
                        {d.status}
                      </Badge>
                    </Td>
                    <Td>{when(d.started_at)}</Td>
                    <Td className="text-right font-[family-name:var(--font-mono)] tabular-nums">
                      {d.duration_seconds === null ||
                      d.duration_seconds === undefined
                        ? "-"
                        : `${Math.floor(d.duration_seconds / 60)}m ${d.duration_seconds % 60}s`}
                    </Td>
                    <Td className="text-right font-[family-name:var(--font-mono)] tabular-nums">
                      {d.batch_count.toLocaleString()}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
              {deliveries.data?.pagination && (
                <Pagination
                  page={deliveries.data.pagination.page}
                  totalPages={deliveries.data.pagination.total_pages}
                  totalItems={deliveries.data.pagination.total_items}
                  onChange={setDeliveryPage}
                />
              )}
            </>
          )}
        </div>
      )}

      {tab === "people" && (
        <div className="mt-6">
          {members.loading ? (
            <LoadingState label="Loading people" />
          ) : members.error ? (
            <ErrorState
              message={members.error.message}
              code={members.error.code}
              requestId={members.error.requestId}
              onRetry={members.reload}
            />
          ) : (members.data ?? []).length === 0 ? (
            <EmptyState title="Nobody can sign in" description="" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Last seen</Th>
                </tr>
              </thead>
              <tbody>
                {(members.data ?? []).map((m) => (
                  <Tr key={m.id}>
                    <Td>{m.name}</Td>
                    <Td className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]">
                      {m.email}
                    </Td>
                    <Td>
                      <Badge tone={m.role === "company_admin" ? "brand" : "neutral"}>
                        {m.role.replace("_", " ")}
                      </Badge>
                    </Td>
                    <Td>{when(m.last_seen_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}

      {openDelivery && (
        <DeliveryDetailModal
          deliveryId={openDelivery}
          onClose={() => setOpenDelivery(null)}
        />
      )}

      {editing && (
        <StatusModal
          current={c.status as CompanyStatus}
          currentLimit={c.rate_limit_per_minute ?? null}
          onClose={() => setEditing(false)}
          onSave={async (status, limit) => {
            try {
              const updated = await companiesApi.setStatus({ token }, id, status, limit);
              company.setData(updated);
              push(`${c.name} is now ${status}.`);
              setEditing(false);
            } catch (err) {
              const message =
                err instanceof ApiRequestError
                  ? err.message
                  : "Could not change that status.";
              push(message, "danger");
            }
          }}
        />
      )}

      <ToastStack toasts={toasts} />
    </>
  );
}

function StatusModal({
  current,
  currentLimit,
  onClose,
  onSave,
}: {
  current: CompanyStatus;
  currentLimit: number | null;
  onClose: () => void;
  onSave: (status: CompanyStatus, limit: number | null) => Promise<void>;
}) {
  const [status, setStatus] = useState<CompanyStatus>(current);
  // Seeded from the stored value. Left blank it used to look unset, so an
  // operator who opened the dialog to change a status silently wiped whatever
  // ceiling was already in place when they saved.
  const [limit, setLimit] = useState(currentLimit?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <Modal open title="Change status" onClose={onClose}>
      <Field
        label="Status"
        hint={
          status === "suspended"
            ? "Immediate and total: the dashboard, every API key and every live device token stop working on the next request."
            : status === "pending"
              ? "The company keeps its data but cannot use the dashboard or the API until it is active again."
              : "Normal operation."
        }
      >
        {(props) => (
          <Select
            {...props}
            value={status}
            onChange={(e) => setStatus(e.target.value as CompanyStatus)}
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </Select>
        )}
      </Field>

      <Field
        label="Rate limit, requests per minute"
        hint="Leave blank to use the deployment default, so raising that lifts this company too."
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            min={1}
            value={limit}
            placeholder="default"
            onChange={(e) => setLimit(e.target.value)}
          />
        )}
      </Field>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant={status === "suspended" ? "danger" : "primary"}
          loading={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(status, limit.trim() === "" ? null : Number(limit));
            setSaving(false);
          }}
        >
          {status === "suspended" ? "Suspend" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}


/** How long ago, in words somebody can act on. */
function ago(value: string | null | undefined): string {
  if (!value) return "never";
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / 60 / 24);
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Thirty days of API usage.
 *
 * Below three points there is no shape to compare, so the panel says the
 * number instead of drawing one bar across its whole width - which reads as a
 * rendering fault rather than as a company that started yesterday.
 */
function UsageChart({ points }: { points: UsagePoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        No API usage recorded yet.
      </p>
    );
  }
  if (points.length < 3) {
    return (
      <div>
        {points.map((p) => (
          <div
            key={p.day}
            className="flex items-baseline justify-between border-b border-[var(--color-border)] py-2 last:border-0"
          >
            <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {p.day}
            </span>
            <span className="tabular-nums">{p.request_count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  const peak = Math.max(...points.map((p) => p.request_count), 1);
  return (
    <>
      <div className="flex h-24 items-end gap-[3px]">
        {points.map((p) => (
          <div
            key={p.day}
            title={`${p.day}: ${p.request_count.toLocaleString()} calls, ${p.error_count} errors`}
            className="max-w-[26px] min-w-[3px] flex-1 rounded-t-[2px] bg-[var(--color-teal-200)] transition-colors hover:bg-[var(--color-teal-500)]"
            style={{ height: `${Math.max(2, (p.request_count / peak) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] text-[var(--color-text-muted)]">
        <span>{points[0]?.day}</span>
        <span>{peak.toLocaleString()} peak</span>
        <span>{points[points.length - 1]?.day}</span>
      </div>
    </>
  );
}

function CompanyOverview({
  company,
  summary,
}: {
  company: Company;
  summary: CompanySummary;
}) {
  const inconclusive =
    summary.outcomes.find((o) => o.status === "inconclusive")?.count ?? 0;
  const totalOutcomes = summary.outcomes.reduce((n, o) => n + o.count, 0);
  const liveKeys = summary.api_keys.filter((k) => k.status === "active");
  const staleDevices = summary.devices - summary.active_devices;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Deliveries"
          value={summary.deliveries}
          hint={`${summary.deliveries_30d.toLocaleString()} in 30 days · ${summary.deliveries_today.toLocaleString()} today`}
        />
        <Stat
          label="Active devices"
          value={summary.active_devices}
          tone={staleDevices > 0 ? "warning" : "neutral"}
          hint={
            staleDevices > 0
              ? `${staleDevices} not seen in 7 days`
              : `all ${summary.devices} registered`
          }
        />
        <Stat
          label="API calls, 30d"
          value={summary.api_calls_30d}
          hint={`${summary.api_calls_today.toLocaleString()} today`}
        />
        <Stat
          label="Last delivery"
          value={ago(summary.last_activity_at)}
          tone={summary.last_activity_at ? "neutral" : "warning"}
          hint={
            summary.last_activity_at
              ? new Date(summary.last_activity_at).toLocaleString()
              : "this company has never sent one"
          }
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <Card>
          <CardHeader
            title="API usage"
            description="Last 30 days, read from the daily rollup."
          />
          <div className="mt-4">
            <UsageChart points={summary.usage} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Delivery outcomes" />
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {summary.outcomes.length === 0 ? (
              <span className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                Nothing yet.
              </span>
            ) : (
              summary.outcomes
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((o) => (
                  <span key={o.status} className="inline-flex items-center gap-1.5">
                    <Badge tone={DELIVERY_TONE[o.status as DeliveryStatus] ?? "neutral"}>
                      {o.status}
                    </Badge>
                    <span className="tabular-nums">{o.count.toLocaleString()}</span>
                  </span>
                ))
            )}
          </div>
          {inconclusive > 0 && (
            <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {inconclusive.toLocaleString()} of {totalOutcomes.toLocaleString()} are
              inconclusive — no usable sensor data arrived. A phone that was off,
              out of battery, in a bag, or force closed. Worth a conversation
              with them if it keeps climbing.
            </p>
          )}
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="API keys"
              description="Only the prefix is stored in clear; the key itself cannot be recovered."
            />
          </div>
          <div className="mt-4">
            {summary.api_keys.length === 0 ? (
              <p className="px-5 pb-5 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                This company has no keys, so nothing can enrol a handset.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Key</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Last used</Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.api_keys.map((k) => {
                    const retiring = k.expires_at && k.status === "active";
                    return (
                      <Tr key={k.id}>
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
            )}
          </div>
          {liveKeys.length === 0 && summary.api_keys.length > 0 && (
            <p className="px-5 py-3 text-[length:var(--text-xs)] text-[var(--color-warning-700)]">
              No active key. Their fleet cannot enrol a new handset.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Account" />
            <div className="mt-3">
              <DetailRow label="Handle" value={company.slug} />
              <DetailRow label="Location" value={company.location ?? "not given"} />
              <DetailRow
                label="Category"
                value={company.delivery_category ?? "not given"}
              />
              <DetailRow label="Registered" value={when(company.created_at)} />
              <DetailRow
                label="Rate limit"
                value={
                  summary.rate_limit_per_minute
                    ? `${summary.rate_limit_per_minute}/min`
                    : "deployment default"
                }
              />
              <DetailRow
                label="Stored, 30d"
                value={`${bytes(summary.bytes_stored_30d)} · ${summary.batches_30d.toLocaleString()} batches`}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Told us at signup"
              description="Typed by whoever registered. Never used for limits or metering."
            />
            <div className="mt-3">
              <DetailRow
                label="Delivery partners"
                value={company.delivery_partner_count?.toLocaleString() ?? "not given"}
              />
              <DetailRow
                label="Deliveries per day"
                value={company.average_daily_deliveries?.toLocaleString() ?? "not given"}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
