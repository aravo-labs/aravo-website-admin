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
  Td,
  Th,
  ToastStack,
  Tr,
  useToasts,
} from "@/components/ui";
import { ImageField } from "@/components/ui/ImageField";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { teamApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { ContentStatus, TeamMember } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

const STATUS_TONE = {
  published: "success",
  draft: "warning",
  archived: "neutral",
} as const;

function emptyDraft() {
  return {
    name: "",
    role_title: "",
    bio: "",
    photo_url: "",
    linkedin_url: "",
    x_url: "",
    status: "draft" as ContentStatus,
    sort_order: 0,
  };
}

type Draft = ReturnType<typeof emptyDraft>;

export default function TeamPage() {
  const auth = useAuth();
  const { token } = auth;

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TeamMember | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);
  const { toasts, push } = useToasts();

  const state = useAsync(
    () => teamApi.list(auth, { page, page_size: 20 }),
    [token, page]
  );

  async function remove(member: TeamMember) {
    try {
      await teamApi.remove(auth, member.id);
      push(`Removed ${member.name}.`);
      setConfirmDelete(null);
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not remove.", "danger");
    }
  }

  async function setStatus(member: TeamMember, status: ContentStatus) {
    try {
      await teamApi.update(auth, member.id, { status });
      push(status === "published" ? `${member.name} is on the site.` : "Updated.");
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not update.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Who appears on the public team page."
        actions={<Button onClick={() => setEditing("new")}>Add member</Button>}
      />

      {state.loading ? (
        <LoadingState label="Loading team" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Add the first one, then publish when the profile is ready."
          action={<Button onClick={() => setEditing("new")}>Add member</Button>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((member) => (
                <Tr key={member.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      {/* Photos are arbitrary remote URLs, so a plain img keeps
                          this off the Next image optimiser and its allowlist. */}
                      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-surface-sunken)] font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
                        {member.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.photo_url}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          member.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <button
                        className="text-left font-medium hover:text-[var(--color-accent)]"
                        onClick={() => setEditing(member)}
                      >
                        {member.name}
                      </button>
                    </div>
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">{member.role_title}</Td>
                  <Td className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {member.sort_order}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[member.status]}>{member.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      {member.status !== "published" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus(member, "published")}
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(member, "draft")}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(member)}
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
        <MemberEditor
          member={editing === "new" ? null : editing}
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
        title="Remove this person?"
        description={
          confirmDelete
            ? `${confirmDelete.name} will be removed from the team page.`
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

function MemberEditor({
  member,
  onClose,
  onSaved,
}: {
  member: TeamMember | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const auth = useAuth();
  const [draft, setDraft] = useState<Draft>(() =>
    member
      ? {
          name: member.name,
          role_title: member.role_title,
          bio: member.bio ?? "",
          photo_url: member.photo_url ?? "",
          linkedin_url: member.linkedin_url ?? "",
          x_url: member.x_url ?? "",
          status: member.status,
          sort_order: member.sort_order,
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
      if (member) {
        await teamApi.update(auth, member.id, draft);
      } else {
        await teamApi.create(auth, draft);
      }
      onSaved(member ? "Member updated." : "Member added.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFieldErrors(err.fieldErrors);
        // Show a cross-field rule even when other fields also failed: it is
        // the part the user cannot work out from the inputs alone.
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
      title={member ? "Edit member" : "Add member"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {member ? "Save changes" : "Add member"}
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
              />
            )}
          </Field>
          <Field label="Role" required error={fieldErrors.role_title}>
            {(p) => (
              <Input
                {...p}
                value={draft.role_title}
                invalid={!!fieldErrors.role_title}
                onChange={(e) => set("role_title", e.target.value)}
                placeholder="Head of Engineering"
              />
            )}
          </Field>
        </div>

        <Field label="Bio" error={fieldErrors.bio}>
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={120}
              value={draft.bio}
              invalid={!!fieldErrors.bio}
              onChange={(html) => set("bio", html)}
            />
          )}
        </Field>

        <Field
          label="Photo"
          error={fieldErrors.photo_url}
          hint="Choose a file, or paste an address if it is already hosted."
        >
          {(p) => (
            <ImageField
              {...p}
              kind="team"
              value={draft.photo_url}
              onChange={(url) => set("photo_url", url)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn" error={fieldErrors.linkedin_url}>
            {(p) => (
              <Input
                {...p}
                value={draft.linkedin_url}
                invalid={!!fieldErrors.linkedin_url}
                onChange={(e) => set("linkedin_url", e.target.value)}
                placeholder="https://linkedin.com/in/…"
              />
            )}
          </Field>
          <Field label="X" error={fieldErrors.x_url}>
            {(p) => (
              <Input
                {...p}
                value={draft.x_url}
                invalid={!!fieldErrors.x_url}
                onChange={(e) => set("x_url", e.target.value)}
                placeholder="https://x.com/…"
              />
            )}
          </Field>
        </div>

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
