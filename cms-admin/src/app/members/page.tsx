"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  ToastStack,
  Tr,
  useToasts,
} from "@/components/ui";
import { membersApi, type CurrentAdmin, type Member } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

const ROLE_TONE = {
  owner: "brand",
  admin: "info",
  editor: "neutral",
} as const;

const ROLE_HELP: Record<Member["role"], string> = {
  editor: "Read and write content.",
  admin: "The above, plus delete.",
  owner: "Everything, including managing people.",
};

export default function MembersPage() {
  const auth = useAuth();
  const { token } = auth;
  const { toasts, push } = useToasts();
  const [inviting, setInviting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

  const state = useAsync(
    async () => {
      const [me, list] = await Promise.all([
        membersApi.me(auth),
        membersApi.list(auth, { page_size: 100 }),
      ]);
      return { me, members: list.items };
    },
    [token]
  );

  function fail(err: unknown, fallback: string) {
    push(err instanceof ApiRequestError ? err.summary : fallback, "danger");
  }

  async function setRole(member: Member, role: Member["role"]) {
    try {
      await membersApi.update(auth, member.id, { role });
      push(`${member.name} is now ${role === "owner" ? "an" : "an"} ${role}.`);
      state.reload();
    } catch (err) {
      fail(err, "Could not change that role.");
    }
  }

  async function setActive(member: Member, is_active: boolean) {
    try {
      await membersApi.update(auth, member.id, { is_active });
      push(is_active ? `${member.name} can sign in again.` : `${member.name} is deactivated.`);
      state.reload();
    } catch (err) {
      fail(err, "Could not update that account.");
    }
  }

  async function remove(member: Member) {
    try {
      await membersApi.remove(auth, member.id);
      push(`Removed ${member.name}.`);
      setConfirmRemove(null);
      state.reload();
    } catch (err) {
      fail(err, "Could not remove that account.");
    }
  }

  if (state.loading) return <LoadingState label="Loading people" />;
  if (state.error)
    return (
      <ErrorState
        message={state.error.message}
        code={state.error.code}
        requestId={state.error.requestId}
        onRetry={state.reload}
      />
    );

  const { me, members } = state.data!;
  const isOwner = me.role === "owner";

  return (
    <>
      <PageHeader
        title="People"
        description="Who can sign in to this panel. Access is by invitation only."
        actions={
          isOwner ? (
            <Button onClick={() => setInviting(true)}>Invite someone</Button>
          ) : undefined
        }
      />

      {!isOwner && (
        <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          Only an owner can invite people or change roles.
        </p>
      )}

      <Table>
        <thead>
          <tr>
            <Th>Person</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const isSelf = member.id === me.id;
            return (
              <Tr key={member.id}>
                <Td>
                  <span className="font-medium">
                    {member.name}
                    {isSelf && (
                      <span className="ml-2 font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
                        you
                      </span>
                    )}
                  </span>
                  <div className="text-[length:var(--text-xs)] text-[var(--color-text-subtle)]">
                    {member.email}
                  </div>
                </Td>
                <Td>
                  {/* Your own role is shown, never editable: changing it is the
                      easiest way to lock yourself out of the panel. */}
                  {isOwner && !isSelf ? (
                    <Select
                      className="max-w-[9rem]"
                      value={member.role}
                      onChange={(e) => setRole(member, e.target.value as Member["role"])}
                    >
                      <option value="editor">editor</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </Select>
                  ) : (
                    <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>
                  )}
                </Td>
                <Td>
                  <Badge tone={member.is_active ? "success" : "neutral"}>
                    {member.is_active ? "active" : "deactivated"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    {isOwner && !isSelf && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActive(member, !member.is_active)}
                        >
                          {member.is_active ? "Deactivate" : "Reactivate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmRemove(member)}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>

      {inviting && (
        <InviteDialog
          me={me}
          onClose={() => setInviting(false)}
          onDone={(message) => {
            push(message);
            setInviting(false);
            state.reload();
          }}
        />
      )}

      <Modal
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title="Remove this person?"
        description={
          confirmRemove
            ? `${confirmRemove.name} loses access immediately, and their sign-in account is deleted.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmRemove && remove(confirmRemove)}>
              Remove access
            </Button>
          </>
        }
      />

      <ToastStack toasts={toasts} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function InviteDialog({
  me,
  onClose,
  onDone,
}: {
  me: CurrentAdmin;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Member["role"]>("editor");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function invite() {
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await membersApi.invite(auth, { email: email.trim(), name: name.trim(), role });
      onDone(`Invitation sent to ${email.trim()}.`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFieldErrors(err.fieldErrors);
        setFormError(err.formMessage);
      } else {
        setFormError("Could not send the invitation.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite someone"
      description={`They will receive an email and choose their own password. Inviting as ${me.name}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={invite} loading={busy} disabled={!email.trim() || !name.trim()}>
            Send invitation
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger-700)]">
            {formError}
          </p>
        )}

        <Field label="Name" required error={fieldErrors.name}>
          {(p) => (
            <Input
              {...p}
              value={name}
              invalid={!!fieldErrors.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Grace Hopper"
            />
          )}
        </Field>

        <Field label="Email" required error={fieldErrors.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              value={email}
              invalid={!!fieldErrors.email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="grace@example.com"
            />
          )}
        </Field>

        <Field label="Role" hint={ROLE_HELP[role]}>
          {(p) => (
            <Select
              {...p}
              value={role}
              onChange={(e) => setRole(e.target.value as Member["role"])}
            >
              <option value="editor">editor</option>
              <option value="admin">admin</option>
              <option value="owner">owner</option>
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
