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
import { docsApi, platformsApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { ContentStatus, DocPage, Platform } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync, useDebounced } from "@/lib/useAsync";

const TABS = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "archived", label: "Archived" },
] as const;

const STATUS_TONE = {
  published: "success",
  draft: "warning",
  archived: "neutral",
} as const;

/**
 * The sections an SDK's documentation is usually cut into, in the order a
 * reader works through them. Only suggestions - the field takes anything.
 */
const SECTION_SUGGESTIONS = [
  "Installation",
  "Configuration",
  "Usage",
  "API reference",
  "Examples",
  "Troubleshooting",
] as const;

function emptyDraft() {
  return {
    title: "",
    section: "Getting started",
    summary: "",
    body_html: "",
    platform_id: "" as string,
    status: "draft" as ContentStatus,
    sort_order: 0,
  };
}

type Draft = ReturnType<typeof emptyDraft>;

export default function DocsPage() {
  const auth = useAuth();
  const { token } = auth;

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // The box stays responsive; the request waits for a pause in typing.
  const query = useDebounced(search);
  const [editing, setEditing] = useState<DocPage | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocPage | null>(null);
  const { toasts, push } = useToasts();

  // Loaded once for the whole page: the editor needs it for its picker and
  // the table needs it to name a page's platform without a second lookup.
  const platforms = useAsync(() => platformsApi.list(auth, { page_size: 100 }), [token]);

  const state = useAsync(
    () =>
      docsApi.list(auth, {
        page,
        page_size: 20,
        q: query || undefined,
        status: tab === "all" ? null : tab,
      }),
    [token, tab, page, query]
  );

  async function remove(doc: DocPage) {
    try {
      await docsApi.remove(auth, doc.id);
      push(`Deleted “${doc.title}”.`);
      setConfirmDelete(null);
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not delete.", "danger");
    }
  }

  async function setStatus(doc: DocPage, status: ContentStatus) {
    try {
      await docsApi.update(auth, doc.id, { status });
      push(status === "published" ? `“${doc.title}” is live.` : "Updated.");
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not update.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="SDK docs"
        description="Documentation pages published to the public docs site."
        actions={<Button onClick={() => setEditing("new")}>New page</Button>}
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
          placeholder="Search title or section"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

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
          title={search ? "No pages match" : "No documentation yet"}
          description={
            search ? "Try a different term." : "Write the first page and publish it."
          }
          action={!search && <Button onClick={() => setEditing("new")}>New page</Button>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Page</Th>
                <Th>Section</Th>
                <Th>Platform</Th>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((doc) => (
                <Tr key={doc.id}>
                  <Td>
                    <button
                      className="text-left font-medium hover:text-[var(--color-accent)]"
                      onClick={() => setEditing(doc)}
                    >
                      {doc.title}
                    </button>
                    <div className="font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
                      /{doc.slug}
                    </div>
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">{doc.section}</Td>
                  <Td className="text-[var(--color-text-muted)]">
                    {doc.platform_id ? (
                      platformName(platforms.data?.items, doc.platform_id)
                    ) : (
                      /* Not "none": the page belongs to all of them, and
                         "none" would read as something left unset. */
                      <span className="text-[var(--color-text-subtle)]">All platforms</span>
                    )}
                  </Td>
                  <Td className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {doc.sort_order}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[doc.status]}>{doc.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      {doc.status !== "published" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus(doc, "published")}
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(doc, "draft")}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(doc)}
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
        <DocEditor
          doc={editing === "new" ? null : editing}
          platforms={platforms.data?.items ?? []}
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
        title="Delete this page?"
        description={
          confirmDelete ? `“${confirmDelete.title}” will be removed.` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>
              Delete page
            </Button>
          </>
        }
      />

      <ToastStack toasts={toasts} />
    </>
  );
}

/** The platform's name, or its id if the list has not loaded yet. */
function platformName(platforms: readonly Platform[] | undefined, id: string): string {
  return platforms?.find((p) => p.id === id)?.name ?? "\u2014";
}

function DocEditor({
  doc,
  platforms,
  onClose,
  onSaved,
}: {
  doc: DocPage | null;
  platforms: readonly Platform[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const auth = useAuth();
  const [draft, setDraft] = useState<Draft>(() =>
    doc
      ? {
          title: doc.title,
          section: doc.section,
          summary: doc.summary ?? "",
          body_html: doc.body_html,
          platform_id: doc.platform_id ?? "",
          status: doc.status,
          sort_order: doc.sort_order,
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
      // "" is the All platforms option. The column is nullable and that is
      // what "belongs to every platform" means, so it goes over as null
      // rather than as an empty string the API would reject as a bad uuid.
      const body = { ...draft, platform_id: draft.platform_id || null };
      if (doc) {
        await docsApi.update(auth, doc.id, body);
      } else {
        await docsApi.create(auth, body);
      }
      onSaved(doc ? "Page updated." : "Page created.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFieldErrors(err.fieldErrors);
        // Show a cross-field rule even when other fields also failed: it is
        // the part the user cannot work out from the inputs alone.
        setFormError(err.formMessage);
      } else {
        setFormError("Could not save the page.");
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
      title={doc ? "Edit page" : "New page"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {doc ? "Save changes" : "Create page"}
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

        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Title" required error={fieldErrors.title}>
            {(p) => (
              <Input
                {...p}
                value={draft.title}
                invalid={!!fieldErrors.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Installing the SDK"
              />
            )}
          </Field>
          <Field
            label="Section"
            required
            error={fieldErrors.section}
            hint="Pages with the same section are grouped under it in the sidebar."
          >
            {(p) => (
              <>
                <Input
                  {...p}
                  list="doc-sections"
                  value={draft.section}
                  onChange={(e) => set("section", e.target.value)}
                  placeholder="Installation"
                />
                {/* Suggestions rather than a fixed list: these are the sections
                    an SDK's documentation usually has, and a platform that
                    needs one of its own should not have to wait for a deploy
                    to get it. A datalist offers without constraining. */}
                <datalist id="doc-sections">
                  {SECTION_SUGGESTIONS.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </div>

        <Field
          label="Summary"
          error={fieldErrors.summary}
          hint="One sentence, shown in the docs navigation."
        >
          {(p) => (
            <Input
              {...p}
              value={draft.summary}
              onChange={(e) => set("summary", e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Platform"
          hint="Leave as All platforms for pages that belong to every SDK, like concepts or webhooks."
          error={fieldErrors.platform_id}
        >
          {(p) => (
            <Select
              {...p}
              value={draft.platform_id}
              onChange={(e) => set("platform_id", e.target.value)}
            >
              <option value="">All platforms</option>
              {platforms.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Body"
          error={fieldErrors.body_html}
          hint="Rendered on the public docs page exactly as it looks here."
        >
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={340}
              value={draft.body_html}
              invalid={!!fieldErrors.body_html}
              onChange={(html) => set("body_html", html)}
              placeholder="Write the page. Use the toolbar for headings, lists and code."
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
                <option value="draft">Draft — hidden</option>
                <option value="published">Published — visible</option>
                <option value="archived">Archived</option>
              </Select>
            )}
          </Field>
          <Field
            label="Sort order"
            hint="Lowest first. A section is placed by the lowest number in it, so numbering across the whole platform - 10, 20, 30 - orders both the sections and the pages."
          >
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
