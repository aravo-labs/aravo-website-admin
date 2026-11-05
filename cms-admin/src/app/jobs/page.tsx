"use client";

import { useState } from "react";

import {
  Badge,
  BulletListInput,
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
import { jobsApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { ContentStatus, Job } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync, useDebounced } from "@/lib/useAsync";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "archived", label: "Archived" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

const STATUS_TONE = {
  published: "success",
  draft: "warning",
  archived: "neutral",
} as const;

/** A blank job, matching what the API will accept. */
function emptyDraft() {
  return {
    title: "",
    department: "",
    location: "",
    employment_type: "Full-time",
    about: "",
    responsibilities: [] as string[],
    requirements: [] as string[],
    nice_to_have: [] as string[],
    status: "draft" as ContentStatus,
    sort_order: 0,
  };
}

type Draft = ReturnType<typeof emptyDraft>;

export default function JobsPage() {
  const auth = useAuth();
  const { token } = auth;

  const [tab, setTab] = useState<StatusTab>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // The box stays responsive; the request waits for a pause in typing.
  const query = useDebounced(search);
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Job | null>(null);
  const { toasts, push } = useToasts();

  const state = useAsync(
    () =>
      jobsApi.list(auth, {
        page,
        page_size: 20,
        q: query || undefined,
        status: tab === "all" ? null : tab,
      }),
    [token, tab, page, query]
  );

  async function remove(job: Job) {
    try {
      await jobsApi.remove(auth, job.id);
      push(`Deleted “${job.title}”.`);
      setConfirmDelete(null);
      state.reload();
    } catch (err) {
      push(
        err instanceof ApiRequestError ? err.message : "Could not delete the role.",
        "danger"
      );
    }
  }

  async function setStatus(job: Job, status: ContentStatus) {
    try {
      await jobsApi.setStatus(auth, job.id, status);
      push(status === "published" ? `“${job.title}” is live.` : `“${job.title}” updated.`);
      state.reload();
    } catch (err) {
      push(
        err instanceof ApiRequestError ? err.message : "Could not update the role.",
        "danger"
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Roles"
        description="Everything on the careers page. Drafts are invisible to visitors."
        actions={<Button onClick={() => setEditing("new")}>New role</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={STATUS_TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setPage(1);
          }}
        />
        <Input
          className="max-w-xs"
          placeholder="Search title, department, location"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {state.loading ? (
        <LoadingState label="Loading roles" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title={search ? "No roles match that search" : "No roles yet"}
          description={
            search
              ? "Try a different term."
              : "Create your first role and publish it when it is ready."
          }
          action={
            !search && <Button onClick={() => setEditing("new")}>New role</Button>
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Role</Th>
                <Th>Department</Th>
                <Th>Location</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((job) => (
                <Tr key={job.id}>
                  <Td>
                    <button
                      className="text-left font-medium hover:text-[var(--color-accent)]"
                      onClick={() => setEditing(job)}
                    >
                      {job.title}
                    </button>
                    <div className="font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
                      /{job.slug}
                    </div>
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">{job.department}</Td>
                  <Td className="text-[var(--color-text-muted)]">{job.location}</Td>
                  <Td className="text-[var(--color-text-muted)]">
                    {job.employment_type}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[job.status]}>{job.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      {job.status !== "published" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus(job, "published")}
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(job, "draft")}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(job)}
                      >
                        Delete
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

      {editing && (
        <JobEditor
          token={token}
          job={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            push(message);
            setEditing(null);
            state.reload();
          }}
        />
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this role?"
        description={
          confirmDelete
            ? `“${confirmDelete.title}” will be removed from the careers page. Applications already received are kept.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>
              Delete role
            </Button>
          </>
        }
      />

      <ToastStack toasts={toasts} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function JobEditor({
  token,
  job,
  onClose,
  onSaved,
}: {
  token: string;
  job: Job | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    job
      ? {
          title: job.title,
          department: job.department,
          location: job.location,
          employment_type: job.employment_type,
          about: job.about,
          responsibilities: [...job.responsibilities],
          requirements: [...job.requirements],
          nice_to_have: [...job.nice_to_have],
          status: job.status,
          sort_order: job.sort_order,
        }
      : emptyDraft()
  );
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    try {
      // Blank bullet lines are stripped server-side; send them as typed.
      const payload = { ...draft };
      if (job) {
        await jobsApi.update({ token }, job.id, payload);
      } else {
        await jobsApi.create({ token }, payload);
      }
      onSaved(job ? "Role updated." : "Role created.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        // Field-level messages land next to their inputs; a cross-field rule
        // has no field of its own, so it is shown once at the top.
        setFieldErrors(err.fieldErrors);
        setFormError(err.formMessage);
      } else {
        setFormError("Could not save the role.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={job ? "Edit role" : "New role"}
      description={
        job ? `Last updated ${new Date(job.updated_at).toLocaleString()}` : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {job ? "Save changes" : "Create role"}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto pr-1">
        {formError && (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger-700)]">
            {formError}
          </p>
        )}

        <Field label="Title" required error={fieldErrors.title}>
          {(p) => (
            <Input
              {...p}
              value={draft.title}
              invalid={!!fieldErrors.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Senior ML Engineer"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department" required error={fieldErrors.department}>
            {(p) => (
              <Input
                {...p}
                value={draft.department}
                invalid={!!fieldErrors.department}
                onChange={(e) => set("department", e.target.value)}
                placeholder="Engineering"
              />
            )}
          </Field>
          <Field label="Employment type" required error={fieldErrors.employment_type}>
            {(p) => (
              <Select
                {...p}
                value={draft.employment_type}
                onChange={(e) => set("employment_type", e.target.value)}
              >
                {["Full-time", "Part-time", "Contract", "Internship"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Location" required error={fieldErrors.location}>
          {(p) => (
            <Input
              {...p}
              value={draft.location}
              invalid={!!fieldErrors.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Hybrid — New York City"
            />
          )}
        </Field>

        <Field
          label="About the role"
          required
          error={fieldErrors.about}
          hint="Two or three sentences. Shown at the top of the role page."
        >
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={180}
              value={draft.about}
              invalid={!!fieldErrors.about}
              onChange={(html) => set("about", html)}
            />
          )}
        </Field>

        <Field label="What you'll do" hint="One per line.">
          {(p) => (
            <BulletListInput
              {...p}
              value={draft.responsibilities}
              onChange={(v) => set("responsibilities", v)}
              placeholder={"Build and deploy ML models in production.\nDesign scalable data pipelines."}
            />
          )}
        </Field>

        <Field label="What we're looking for" hint="One per line.">
          {(p) => (
            <BulletListInput
              {...p}
              value={draft.requirements}
              onChange={(v) => set("requirements", v)}
            />
          )}
        </Field>

        <Field label="Nice to have" hint="One per line.">
          {(p) => (
            <BulletListInput
              {...p}
              value={draft.nice_to_have}
              onChange={(v) => set("nice_to_have", v)}
              rows={3}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            {(p) => (
              <Select
                {...p}
                value={draft.status}
                onChange={(e) => set("status", e.target.value as ContentStatus)}
              >
                <option value="draft">Draft — hidden from the site</option>
                <option value="published">Published — visible</option>
                <option value="archived">Archived</option>
              </Select>
            )}
          </Field>
          <Field label="Sort order" hint="Lower numbers appear first.">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                value={draft.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
              />
            )}
          </Field>
        </div>
      </div>
    </Modal>
  );
}
