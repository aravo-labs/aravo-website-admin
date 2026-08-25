"use client";

/**
 * Pages written here rather than in the codebase.
 *
 * Every standalone page on the site - the privacy policy, the terms, an
 * announcement, whatever gets written next - is a row in this list. The
 * alternative is a developer and a deploy every time somebody needs a page,
 * which is the thing this screen exists to stop.
 *
 * The address is the slug, and the page appears at that address on the site.
 * It stays editable after publishing, like everything else here: publishing
 * something is not a decision to stop working on it. The footer is built from
 * these rows, so renaming a page renames the link rather than breaking it -
 * only a link somebody was already sent goes stale, which is what the hint on
 * the field says.
 *
 * Privacy and terms arrive seeded and marked. The mark is not a lock: it is
 * how the delete confirmation knows to mention that the footer points here.
 */

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
  Td,
  Th,
  Textarea,
  ToastStack,
  Tr,
  useToasts,
} from "@/components/ui";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { pagesApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { ContentStatus, Page } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

const STATUS_TONE = {
  published: "success",
  draft: "warning",
  archived: "neutral",
} as const;

function emptyDraft() {
  return {
    title: "",
    slug: "",
    eyebrow: "",
    summary: "",
    body_html: "",
    status: "draft" as ContentStatus,
    show_in_footer: true,
  };
}

type Draft = ReturnType<typeof emptyDraft>;

export default function PagesPage() {
  const auth = useAuth();
  const { token } = auth;

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Page | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Page | null>(null);
  const { toasts, push } = useToasts();

  const state = useAsync(
    () => pagesApi.list(auth, { page, page_size: 20 }),
    [token, page],
  );

  async function remove(row: Page) {
    try {
      await pagesApi.remove(auth, row.id);
      push("Page removed.");
      setConfirmDelete(null);
      state.reload();
    } catch (err) {
      push(
        err instanceof ApiRequestError ? err.message : "Could not remove.",
        "danger",
      );
    }
  }

  async function setStatus(row: Page, status: ContentStatus) {
    try {
      await pagesApi.update(auth, row.id, { status });
      push(
        status === "published" ? "Page is on the site." : "Page taken down.",
      );
      state.reload();
    } catch (err) {
      push(
        err instanceof ApiRequestError ? err.message : "Could not update.",
        "danger",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Pages"
        description="Standalone pages on the site. Each one appears at the address shown."
        actions={<Button onClick={() => setEditing("new")}>Add page</Button>}
      />

      {state.loading ? (
        <LoadingState label="Loading pages" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Add one for anything that needs its own address: an announcement, a policy, a note to customers."
          action={<Button onClick={() => setEditing("new")}>Add page</Button>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Address</Th>
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
                      onClick={() => setEditing(row)}
                    >
                      {row.title}
                    </button>
                    {row.locked && (
                      <span className="ml-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                        linked from the footer
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    /{row.slug}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      {row.status !== "published" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus(row, "published")}
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(row, "draft")}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(row)}
                      >
                        Remove
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
        <PageEditor
          page={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            push(m);
            setEditing(null);
            state.reload();
          }}
        />
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Remove this page?"
        description={
          confirmDelete
            ? `/${confirmDelete.slug} will stop working for anybody who has the link.${
                confirmDelete.locked ? " The footer links to this page." : ""
              }`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              Remove
            </Button>
          </>
        }
      />

      <ToastStack toasts={toasts} />
    </>
  );
}

function PageEditor({
  page,
  onClose,
  onSaved,
}: {
  page: Page | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const auth = useAuth();
  const [draft, setDraft] = useState<Draft>(() =>
    page
      ? {
          title: page.title,
          slug: page.slug,
          eyebrow: page.eyebrow ?? "",
          summary: page.summary ?? "",
          body_html: page.body_html,
          status: page.status,
          show_in_footer: page.show_in_footer,
        }
      : emptyDraft(),
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
      const body = {
        title: draft.title,
        eyebrow: draft.eyebrow || null,
        summary: draft.summary || null,
        body_html: draft.body_html,
        status: draft.status,
        show_in_footer: draft.show_in_footer,
      };
      if (page) {
        await pagesApi.update(auth, page.id, { ...body, slug: draft.slug });
      } else {
        await pagesApi.create(auth, { ...body, slug: draft.slug || undefined });
      }
      onSaved(page ? "Page updated." : "Page added.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFieldErrors(err.fieldErrors);
        setFormError(err.formMessage);
      } else {
        setFormError("Could not save.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={page ? "Edit page" : "Add page"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
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
              placeholder="Privacy policy"
            />
          )}
        </Field>

        <Field
          label="Address"
          hint="The page appears at this address. Changing it moves the page; anybody holding the old link will not find it."
          error={fieldErrors.slug}
        >
          {(p) => (
            <Input
              {...p}
              value={draft.slug}
              invalid={!!fieldErrors.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="privacy"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Eyebrow"
            hint="A short label above the title."
            error={fieldErrors.eyebrow}
          >
            {(p) => (
              <Input
                {...p}
                value={draft.eyebrow}
                invalid={!!fieldErrors.eyebrow}
                onChange={(e) => set("eyebrow", e.target.value)}
                placeholder="Legal"
              />
            )}
          </Field>

          <Field label="Status" error={fieldErrors.status}>
            {(p) => (
              <Select
                {...p}
                value={draft.status}
                onChange={(e) => set("status", e.target.value as ContentStatus)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            )}
          </Field>
        </div>

        <Field label="Footer">
          {() => (
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 py-3">
              <input
                type="checkbox"
                checked={draft.show_in_footer}
                onChange={(e) => set("show_in_footer", e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[length:var(--text-sm)] font-medium">
                  Link to this page from the footer
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  Turning this off leaves the page published and reachable. An
                  announcement that has run its course can leave the footer
                  without the link somebody was sent going dead.
                </span>
              </span>
            </label>
          )}
        </Field>

        <Field
          label="Summary"
          hint="One or two sentences under the title, and what search engines show."
          error={fieldErrors.summary}
        >
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={draft.summary}
              invalid={!!fieldErrors.summary}
              onChange={(e) => set("summary", e.target.value)}
            />
          )}
        </Field>

        <Field label="Page" error={fieldErrors.body_html}>
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={280}
              value={draft.body_html}
              invalid={!!fieldErrors.body_html}
              onChange={(html) => set("body_html", html)}
              placeholder="Write the page. Headings become links in the contents list on the side."
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
