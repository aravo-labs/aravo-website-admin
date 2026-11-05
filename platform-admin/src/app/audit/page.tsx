"use client";

/**
 * Who did what, and to whom.
 *
 * Append only — there is no edit and no delete here, and there is none in the
 * API either, because a record the recorded can amend is not a record. What
 * this screen exists for is the question nobody can answer without it: who
 * suspended that company, who revoked that key, and when.
 */

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
  type Tone,
} from "@/components/ui";
import { platformApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

/**
 * What each recorded action is, in words.
 *
 * The stored value stays machine-readable — `company.status_changed` is what
 * filters and future tooling match on, and renaming it would break every
 * older row. What changes is what a person reads: somebody scanning this page
 * at nine in the morning should not have to parse dotted identifiers to find
 * out who switched a customer off.
 *
 * Colour is by consequence rather than category. Anything that takes access
 * away is the entry being looked for.
 */
const ACTIONS: Record<string, { label: string; tone: Tone }> = {
  "company.status_changed": { label: "Company switched on or off", tone: "warning" },
  "staff.invited": { label: "Administrator invited", tone: "info" },
  "staff.revoked": { label: "Administrator removed", tone: "danger" },
  "member.invited": { label: "Colleague invited", tone: "info" },
  "member.updated": { label: "Colleague's role changed", tone: "neutral" },
  "member.removed": { label: "Colleague removed", tone: "danger" },
  // Somebody reaching for something they do not have. Shown as plainly as the
  // rest: it was reading as the raw "access.denied" beside properly worded
  // labels, which made the one row worth noticing look like a glitch.
  "access.denied": { label: "Access refused", tone: "danger" },
  "api_key.created": { label: "API key issued", tone: "info" },
  "api_key.rotated": { label: "API key rotated", tone: "warning" },
  "api_key.revoked": { label: "API key revoked", tone: "danger" },
};

/** An action we have no wording for is still shown, not swallowed. */
function describe(action: string): { label: string; tone: Tone } {
  return ACTIONS[action] ?? { label: action, tone: "neutral" };
}

function summarise(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  const before = detail.before as Record<string, unknown> | undefined;
  const after = detail.after as Record<string, unknown> | undefined;
  if (before && after) {
    const changed = Object.keys(after)
      .filter((k) => before[k] !== after[k])
      .map((k) => `${FIELDS[k] ?? k}: ${readable(before[k])} → ${readable(after[k])}`);
    // Somebody opening the dialog and saving without changing anything is a
    // real event worth recording. An empty cell reads as a broken row, so it
    // says what happened instead.
    return changed.length ? changed.join(", ") : "saved without changes";
  }
  return Object.entries(detail)
    .filter(([, v]) => v !== null && typeof v !== "object")
    .map(([k, v]) => `${FIELDS[k] ?? k}: ${readable(v)}`)
    .join(", ");
}

/** Who acted, in words. */
/**
 * A role, in the words a customer uses.
 *
 * Shown as it was at the time, not as it is now. That somebody is a viewer
 * today says nothing about what they were when they revoked the key, and an
 * audit that answers the wrong one of those is worse than none.
 */
function roleLabel(role: string): string {
  return (
    {
      company_viewer: "View only",
      company_user: "Edit",
      company_admin: "Full access",
    }[role] ?? role.replace("_", " ")
  );
}

const ACTORS: Record<string, string> = {
  platform_admin: "Aravo staff",
  company_user: "Company user",
  device: "A handset",
  system: "Automatic",
};

/** Column names as a person would say them. */
const FIELDS: Record<string, string> = {
  status: "Status",
  rate_limit_per_minute: "Rate limit",
  role: "Role",
  is_active: "Active",
  email: "Email",
  name: "Name",
  prefix: "Key prefix",
  old_prefix: "Old key",
  new_prefix: "New key",
  overlap_hours: "Old key valid for",
  retire_devices: "Devices retired",
  email_sent: "Invitation emailed",
};

function readable(value: unknown): string {
  if (value === true) return "yes";
  if (value === false) return "no";
  if (value === null || value === undefined) return "none";
  if (typeof value === "string") {
    // An API key prefix is an identifier, not prose. Replacing its
    // underscores turned "ak_live_zCKh" into "ak live zCKh", which no longer
    // matches anything on the keys page, so the one row that tells you which
    // key was issued could not be matched to the key.
    if (value.startsWith("ak_")) return value;
    return value.replace(/_/g, " ");
  }
  return String(value);
}

export default function AuditPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");

  const state = useAsync(
    (signal) =>
      platformApi.audit(
        { token },
        {
          page,
          page_size: 50,
          action: action || undefined,
          category: category || undefined,
          outcome: outcome || undefined,
        },
        signal,
      ),
    [token, page, action, category, outcome],
  );

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Everything anyone did that changed what somebody else can do. Nothing here can be edited or deleted."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-56">
        <Select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any action</option>
          {Object.entries(ACTIONS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        </div>

        <div className="w-44">
          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any category</option>
            <option value="api_key">API keys</option>
            <option value="member">People</option>
            <option value="company">Companies</option>
            <option value="staff">Staff</option>
            <option value="access">Access refused</option>
          </Select>
        </div>

        <div className="w-44">
          <Select
            aria-label="Filter by result"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any result</option>
            <option value="success">Done</option>
            {/* The one worth looking at. Somebody reaching for something they
                no longer have access to is the signal an audit exists for. */}
            <option value="failure">Refused</option>
          </Select>
        </div>
      </div>

      {state.loading ? (
        <LoadingState label="Loading the trail" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title={action ? "Nothing matches that action" : "Nothing recorded yet"}
          description="Entries appear the moment somebody changes an account, a key or a role."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Company</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Result</Th>
                <Th>What changed</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((e) => (
                <Tr key={e.id}>
                  <Td className="whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </Td>
                  <Td>
                    {/* A company that has since been deleted leaves its rows
                        behind, which is the point of an append-only trail. The
                        name cannot resolve then, and a dash is more honest
                        than an id nobody can look up. */}
                    {e.company_name ?? (e.company_id ? "deleted" : "—")}
                  </Td>
                  <Td>
                    {e.actor_name ?? e.actor_email ?? "system"}
                    <span className="block font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] text-[var(--color-text-muted)]">
                      {e.actor_name && e.actor_email ? `${e.actor_email} · ` : ""}
                      {e.actor_role
                        ? roleLabel(e.actor_role)
                        : (ACTORS[e.actor_type] ?? e.actor_type)}
                      {e.ip ? ` · ${e.ip}` : ""}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={describe(e.action).tone}>
                      {describe(e.action).label}
                    </Badge>
                    {e.category && (
                      <span className="block font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] text-[var(--color-text-muted)]">
                        {e.category}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {/* The half that used to be missing. Every row was a
                        success, because a refused action rolled its own record
                        back, so there was nothing to show here at all. */}
                    <Badge tone={e.outcome === "failure" ? "danger" : "success"}>
                      {e.outcome === "failure" ? "Refused" : "Done"}
                    </Badge>
                  </Td>
                  <Td className="text-[length:var(--text-xs)]">
                    {summarise(e.detail as Record<string, unknown> | null)}
                    {e.request_id && (
                      <span className="block font-[family-name:var(--font-mono)] text-[length:var(--text-2xs)] text-[var(--color-text-muted)]">
                        {e.request_id}
                      </span>
                    )}
                  </Td>
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
