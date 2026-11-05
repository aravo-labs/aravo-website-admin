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
import { applicationsApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { Application, ApplicationStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync, useDebounced } from "@/lib/useAsync";

const TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "reviewing", label: "Reviewing" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "rejected", label: "Rejected" },
  { id: "hired", label: "Hired" },
] as const;

const TONE: Record<ApplicationStatus, "info" | "warning" | "success" | "danger" | "brand"> = {
  new: "info",
  reviewing: "warning",
  shortlisted: "brand",
  rejected: "danger",
  hired: "success",
};

const STATUSES: ApplicationStatus[] = [
  "new",
  "reviewing",
  "shortlisted",
  "rejected",
  "hired",
];

export default function ApplicationsPage() {
  const auth = useAuth();
  const { token } = auth;

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // The box stays responsive; the request waits for a pause in typing.
  const query = useDebounced(search);
  const [open, setOpen] = useState<Application | null>(null);
  const { toasts, push } = useToasts();

  const state = useAsync(
    () =>
      applicationsApi.list(auth, {
        page,
        page_size: 20,
        q: query || undefined,
        status: tab === "all" ? null : tab,
      }),
    [token, tab, page, query]
  );

  async function setStatus(app: Application, status: ApplicationStatus) {
    try {
      await applicationsApi.setStatus(auth, app.id, status);
      push(`Moved ${app.first_name} ${app.last_name} to ${status}.`);
      state.reload();
      setOpen((current) => (current?.id === app.id ? { ...current, status } : current));
    } catch (err) {
      push(
        err instanceof ApiRequestError ? err.message : "Could not update.",
        "danger"
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Applications"
        description="Everything submitted through the careers form."
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
          placeholder="Search name, email, role"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {state.loading ? (
        <LoadingState label="Loading applications" />
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
          description={
            tab === "all"
              ? "Applications appear here as soon as someone applies."
              : `No applications with status “${tab}”.`
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Role</Th>
                <Th>Received</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((app) => (
                <Tr key={app.id}>
                  <Td>
                    <button
                      className="text-left font-medium hover:text-[var(--color-accent)]"
                      onClick={() => setOpen(app)}
                    >
                      {app.first_name} {app.last_name}
                    </button>
                    <div className="text-[length:var(--text-xs)] text-[var(--color-text-subtle)]">
                      {app.email}
                    </div>
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">{app.job_title}</Td>
                  <Td className="text-[var(--color-text-muted)]">
                    {new Date(app.created_at).toLocaleDateString()}
                  </Td>
                  <Td>
                    <Badge tone={TONE[app.status]}>{app.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setOpen(app)}>
                        Review
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
        <ApplicationDetail
          application={open}
          onClose={() => setOpen(null)}
          onStatus={(status) => setStatus(open, status)}
          onSaved={(message) => {
            push(message);
            setOpen(null);
            state.reload();
          }}
        />
      )}

      <ToastStack toasts={toasts} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function ApplicationDetail({
  application,
  onClose,
  onStatus,
  onSaved,
}: {
  application: Application;
  onClose: () => void;
  onStatus: (status: ApplicationStatus) => void;
  onSaved: (message: string) => void;
}) {
  const auth = useAuth();
  const [notes, setNotes] = useState(application.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [notesError, setNotesError] = useState<string | null>(null);

  async function saveNotes() {
    setBusy(true);
    setNotesError(null);
    try {
      await applicationsApi.update(auth, application.id, { notes });
      onSaved("Notes saved.");
    } catch (err) {
      // Not through onSaved: a failed save used to take the success path,
      // which closed the panel over the unsaved text and reported it saved.
      setNotesError(err instanceof ApiRequestError ? err.message : "Could not save notes.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Resume links are signed and short-lived, so one is minted on demand and
   * opened immediately rather than being rendered into the page as an href
   * that would expire while the reviewer reads.
   */
  async function openResume() {
    setResumeError(null);
    try {
      const link = await applicationsApi.resumeLink(auth, application.id);
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setResumeError(
        err instanceof ApiRequestError
          ? err.code === "NOT_FOUND"
            ? "No resume was attached to this application."
            : err.message
          : "Could not produce a download link."
      );
    }
  }

  const rows: Array<[string, string | null]> = [
    ["Role", application.job_title],
    ["Email", application.email],
    ["Phone", application.phone],
    ["LinkedIn", application.linkedin_url],
    ["Received", new Date(application.created_at).toLocaleString()],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${application.first_name} ${application.last_name}`}
      description={application.job_title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={saveNotes} loading={busy}>
            Save notes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
                {label}
              </dt>
              <dd className="mt-0.5 text-[length:var(--text-sm)] break-words">
                {value ? (
                  label === "LinkedIn" ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--color-accent)] underline underline-offset-2"
                    >
                      {value.replace(/^https:\/\//, "")}
                    </a>
                  ) : (
                    value
                  )
                ) : (
                  <span className="text-[var(--color-text-subtle)]">Not provided</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-4 py-3">
          <span className="text-[length:var(--text-sm)]">Resume</span>
          <Button size="sm" variant="secondary" onClick={openResume}>
            {application.resume_filename ?? "Open resume"}
          </Button>
          {resumeError && (
            <span className="text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
              {resumeError}
            </span>
          )}
        </div>

        <Field label="Status">
          {(p) => (
            <Select
              {...p}
              value={application.status}
              onChange={(e) => onStatus(e.target.value as ApplicationStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Internal notes"
          hint="Only visible to the team."
          error={notesError ?? undefined}
        >
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={120}
              value={notes}
              onChange={setNotes}
              placeholder="Strong background in streaming systems. Worth a call."
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
