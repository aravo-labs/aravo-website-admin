"use client";

/**
 * The platforms the SDK ships for.
 *
 * Each row is two things at once: a card on the marketing page, and the
 * grouping that documentation pages hang off. Adding React Native used to
 * mean a deploy; it is now a form.
 *
 * The snippet here is the short one shown on the card - install and initialise
 * - not the documentation. Its language is stored alongside it because the
 * site highlights the code, and a highlighter guessing the language gets
 * Kotlin and Swift wrong in the same way every time.
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
  Textarea,
  Th,
  ToastStack,
  Tr,
  useToasts,
} from "@/components/ui";
import { ImageField } from "@/components/ui/ImageField";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { platformsApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { ContentStatus, Platform } from "@/lib/api/types";

type CodeTheme = Platform["code_theme"];
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

/**
 * What the site can highlight. A closed list rather than a free text box: the
 * highlighter needs a grammar it has loaded, and a typo would silently produce
 * unhighlighted code that looks like a styling bug.
 */
const CODE_LANGUAGES = [
  { value: "kotlin", label: "Kotlin" },
  { value: "java", label: "Java" },
  { value: "swift", label: "Swift" },
  { value: "objectivec", label: "Objective-C" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "dart", label: "Dart" },
  { value: "bash", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
] as const;

/**
 * The painted worlds a snippet can sit in. Named rather than a colour picker:
 * each one is checked for contrast once, here, instead of every time somebody
 * chooses a dark grey and forgets the text is grey too.
 */
const CODE_THEMES = [
  { value: "ink", label: "Ink (near black)" },
  { value: "midnight", label: "Midnight (blue)" },
  { value: "slate", label: "Slate (grey green)" },
  { value: "paper", label: "Paper (light)" },
] as const;

const STATUS_TONE = {
  published: "success",
  draft: "warning",
  archived: "neutral",
} as const;

function emptyDraft() {
  return {
    name: "",
    tagline: "",
    description: "",
    image_url: "",
    request_enabled: true,
    code_snippet: "",
    code_language: "kotlin",
    code_filename: "",
    code_theme: "ink" as CodeTheme,
    status: "draft" as ContentStatus,
    sort_order: 0,
  };
}

type Draft = ReturnType<typeof emptyDraft>;

export default function PlatformsPage() {
  const auth = useAuth();
  const { token } = auth;

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Platform | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Platform | null>(null);
  const { toasts, push } = useToasts();

  const state = useAsync(() => platformsApi.list(auth, { page, page_size: 20 }), [token, page]);

  async function remove(platform: Platform) {
    try {
      await platformsApi.remove(auth, platform.id);
      push("Platform removed.");
      setConfirmDelete(null);
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not remove.", "danger");
    }
  }

  async function setStatus(platform: Platform, status: ContentStatus) {
    try {
      await platformsApi.update(auth, platform.id, { status });
      push(status === "published" ? "Platform is on the site." : "Updated.");
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not update.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="Platforms"
        description="The SDK platforms shown on the site. Each one can carry its own documentation."
        actions={<Button onClick={() => setEditing("new")}>Add platform</Button>}
      />

      {state.loading ? (
        <LoadingState label="Loading platforms" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title="No platforms yet"
          description="Add Android, iOS or React Native, then publish when the documentation is ready."
          action={<Button onClick={() => setEditing("new")}>Add platform</Button>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Platform</Th>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((platform) => (
                <Tr key={platform.id}>
                  <Td>
                    <button
                      className="text-left font-medium hover:text-[var(--color-accent)]"
                      onClick={() => setEditing(platform)}
                    >
                      {platform.name}
                    </button>
                  </Td>
                  <Td className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {platform.sort_order}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[platform.status]}>{platform.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      {platform.status !== "published" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus(platform, "published")}
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(platform, "draft")}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(platform)}>
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
        <PlatformEditor
          platform={editing === "new" ? null : editing}
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
        title="Remove this platform?"
        description={
          confirmDelete
            ? `${confirmDelete.name} will be removed. Its documentation pages are kept and become unassigned.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>
              Remove
            </Button>
          </>
        }
      />

      <ToastStack toasts={toasts} />
    </>
  );
}

function PlatformEditor({
  platform,
  onClose,
  onSaved,
}: {
  platform: Platform | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const auth = useAuth();
  const [draft, setDraft] = useState<Draft>(() =>
    platform
      ? {
          name: platform.name,
          tagline: platform.tagline ?? "",
          description: platform.description,
          image_url: platform.image_url ?? "",
          request_enabled: platform.request_enabled,
          code_snippet: platform.code_snippet,
          code_language: platform.code_language,
          code_filename: platform.code_filename ?? "",
          code_theme: platform.code_theme,
          status: platform.status,
          sort_order: platform.sort_order,
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
      if (platform) await platformsApi.update(auth, platform.id, draft);
      else await platformsApi.create(auth, draft);
      onSaved(platform ? "Platform updated." : "Platform added.");
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
      title={platform ? "Edit question" : "Add platform"}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={fieldErrors.name}>
            {(p) => (
              <Input
                {...p}
                value={draft.name}
                invalid={!!fieldErrors.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="React Native"
              />
            )}
          </Field>

          <Field
            label="Tagline"
            hint="One line under the name on the card."
            error={fieldErrors.tagline}
          >
            {(p) => (
              <Input
                {...p}
                value={draft.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                placeholder="Kotlin, minSdk 24"
              />
            )}
          </Field>
        </div>

        <Field label="Description" error={fieldErrors.description}>
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={140}
              value={draft.description}
              invalid={!!fieldErrors.description}
              onChange={(html) => set("description", html)}
              placeholder="What this platform's SDK does and what it needs."
            />
          )}
        </Field>

        <Field
          label="Card image"
          hint="Shown on the platform card. Leave empty for the drawn placeholder."
          error={fieldErrors.image_url}
        >
          {(p) => (
            <ImageField
              {...p}
              value={draft.image_url}
              onChange={(url) => set("image_url", url)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code language"
            hint="Drives the syntax highlighting on the site."
            error={fieldErrors.code_language}
          >
            {(p) => (
              <Select
                {...p}
                value={draft.code_language}
                onChange={(e) => set("code_language", e.target.value)}
              >
                {CODE_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="File name"
            hint="Shown above the snippet."
            error={fieldErrors.code_filename}
          >
            {(p) => (
              <Input
                {...p}
                value={draft.code_filename}
                onChange={(e) => set("code_filename", e.target.value)}
                placeholder="DeliveryTracker.kt"
              />
            )}
          </Field>
        </div>

        <Field
          label="Snippet colours"
          hint="How the code block is painted on the site."
          error={fieldErrors.code_theme}
        >
          {(p) => (
            <Select
              {...p}
              value={draft.code_theme}
              onChange={(e) => set("code_theme", e.target.value as CodeTheme)}
            >
              {CODE_THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Snippet"
          hint="The short install-and-initialise example on the card."
          error={fieldErrors.code_snippet}
        >
          {(p) => (
            <Textarea
              {...p}
              rows={10}
              className="font-mono text-[length:var(--text-xs)]"
              value={draft.code_snippet}
              invalid={!!fieldErrors.code_snippet}
              onChange={(e) => set("code_snippet", e.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Order" hint="Lowest first." error={fieldErrors.sort_order}>
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                value={draft.sort_order}
                invalid={!!fieldErrors.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value))}
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
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </Select>
            )}
          </Field>
        </div>

        {/* Separate from Status, because the two answer different questions.
            A platform can be documented and shown on the site while not yet
            being something anybody can ask for, and unpublishing it to keep it
            off one dropdown would take its documentation down as well. */}
        <Field label="SDK access form" error={fieldErrors.request_enabled}>
          {() => (
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 py-3">
              <input
                type="checkbox"
                checked={draft.request_enabled}
                onChange={(e) => set("request_enabled", e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[length:var(--text-sm)] font-medium">
                  Offer this platform on the request form
                </span>
                <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  It appears in the Platform dropdown people choose from when
                  asking for SDK access. Turning it off leaves its
                  documentation and its place on the site untouched.
                </span>
              </span>
            </label>
          )}
        </Field>
      </div>
    </Modal>
  );
}
