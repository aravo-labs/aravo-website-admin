"use client";

/**
 * The questions on the marketing page.
 *
 * A short list where the order is most of the meaning - the first question is
 * the one people actually ask - so ordering is a plain number the author sets
 * rather than something inferred from when a row was written.
 *
 * The answer is a rich-text field, because these answers carry links to the
 * documentation and the occasional list, and asking somebody to write HTML in
 * a textarea to get a link is how FAQs end up as walls of prose.
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
  ToastStack,
  Tr,
  useToasts,
} from "@/components/ui";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { faqsApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { ContentStatus, Faq } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

const STATUS_TONE = {
  published: "success",
  draft: "warning",
  archived: "neutral",
} as const;

function emptyDraft() {
  return {
    question: "",
    answer_html: "",
    status: "published" as ContentStatus,
    sort_order: 0,
  };
}

type Draft = ReturnType<typeof emptyDraft>;

export default function FaqsPage() {
  const auth = useAuth();
  const { token } = auth;

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Faq | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Faq | null>(null);
  const { toasts, push } = useToasts();

  const state = useAsync(() => faqsApi.list(auth, { page, page_size: 20 }), [token, page]);

  async function remove(faq: Faq) {
    try {
      await faqsApi.remove(auth, faq.id);
      push("Question removed.");
      setConfirmDelete(null);
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not remove.", "danger");
    }
  }

  async function setStatus(faq: Faq, status: ContentStatus) {
    try {
      await faqsApi.update(auth, faq.id, { status });
      push(status === "published" ? "Question is on the site." : "Updated.");
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not update.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="Common questions"
        description="The question and answer list on the marketing page. Lowest order number first."
        actions={<Button onClick={() => setEditing("new")}>Add question</Button>}
      />

      {state.loading ? (
        <LoadingState label="Loading questions" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Add the ones people ask before they get in touch."
          action={<Button onClick={() => setEditing("new")}>Add question</Button>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Question</Th>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((faq) => (
                <Tr key={faq.id}>
                  <Td>
                    <button
                      className="text-left font-medium hover:text-[var(--color-accent)]"
                      onClick={() => setEditing(faq)}
                    >
                      {faq.question}
                    </button>
                  </Td>
                  <Td className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {faq.sort_order}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[faq.status]}>{faq.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      {faq.status !== "published" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus(faq, "published")}
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(faq, "draft")}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(faq)}>
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
        <FaqEditor
          faq={editing === "new" ? null : editing}
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
        title="Remove this question?"
        description={confirmDelete ? confirmDelete.question : undefined}
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

function FaqEditor({
  faq,
  onClose,
  onSaved,
}: {
  faq: Faq | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const auth = useAuth();
  const [draft, setDraft] = useState<Draft>(() =>
    faq
      ? {
          question: faq.question,
          answer_html: faq.answer_html,
          status: faq.status,
          sort_order: faq.sort_order,
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
      if (faq) await faqsApi.update(auth, faq.id, draft);
      else await faqsApi.create(auth, draft);
      onSaved(faq ? "Question updated." : "Question added.");
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
      title={faq ? "Edit question" : "Add question"}
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

        <Field label="Question" required error={fieldErrors.question}>
          {(p) => (
            <Input
              {...p}
              value={draft.question}
              invalid={!!fieldErrors.question}
              onChange={(e) => set("question", e.target.value)}
              placeholder="Does the SDK track drivers between deliveries?"
            />
          )}
        </Field>

        <Field label="Answer" error={fieldErrors.answer_html}>
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={180}
              value={draft.answer_html}
              invalid={!!fieldErrors.answer_html}
              onChange={(html) => set("answer_html", html)}
              placeholder="Answer it plainly, and link to the documentation if there is more."
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
      </div>
    </Modal>
  );
}
